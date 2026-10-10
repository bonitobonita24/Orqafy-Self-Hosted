// AUDIT M-1 regression coverage: createFirstAdmin must (a) refuse to run when
// SETUP_TOKEN is unset, (b) reject a wrong token, (c) create exactly one owner
// on a correct token against a fresh DB, and (d) stay race-safe under two
// concurrent first-run attempts — the advisory lock inside the transaction is
// modeled as a serializing mutex over a shared in-memory user store so only
// one of two interleaved calls can ever create the owner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';
import { SYSTEM_ROLE_ORDER } from '@orqafy/shared';

vi.mock('../../lib/password', () => ({
  hashPassword: (plain: string) => Promise.resolve(`hashed:${plain}`),
}));

const { setupRouter } = await import('./setup');

const SETUP_TOKEN = 'test-setup-token-xxxxxxxxxxxxxxxx';

/** A shared in-memory "database" + advisory-lock mutex for one test's DB. */
function createSharedDb() {
  return {
    users: [] as Array<{ id: string; email: string; roleId: string }>,
    organizations: [] as Array<{ id: string; name: string }>,
    permissionGroups: [] as Array<{
      id: string;
      systemKey: string;
      name: string;
      permissions: unknown;
      isSystem: boolean;
    }>,
    locked: false,
    waiters: [] as Array<() => void>,
    nextId: 0,
  };
}
type SharedDb = ReturnType<typeof createSharedDb>;

/** Models `pg_advisory_xact_lock` as a FIFO mutex released when the tx ends. */
function acquireLock(db: SharedDb): Promise<void> {
  return new Promise((resolve) => {
    if (!db.locked) {
      db.locked = true;
      resolve();
    } else {
      db.waiters.push(() => {
        db.locked = true;
        resolve();
      });
    }
  });
}

function releaseLock(db: SharedDb): void {
  db.locked = false;
  const next = db.waiters.shift();
  if (next !== undefined) next();
}

function makeTx(db: SharedDb) {
  return {
    $executeRaw: async () => {
      await acquireLock(db);
      // Lock acquired — caller re-checks user.count() next, as the real code does.
    },
    user: {
      count: () => Promise.resolve(db.users.length),
      create: ({ data }: { data: { email: string; roleId: string } }) => {
        const user = { id: `u${++db.nextId}`, email: data.email, roleId: data.roleId };
        db.users.push(user);
        return Promise.resolve(user);
      },
    },
    organization: {
      // Oldest-first, same deterministic ordering as the real
      // `orderBy: { createdAt: 'asc' }` — array push order models creation order.
      findFirst: () => Promise.resolve(db.organizations[0] ?? null),
      create: ({ data }: { data: { name: string } }) => {
        const org = { id: `org${++db.nextId}`, name: data.name };
        db.organizations.push(org);
        return Promise.resolve(org);
      },
      update: ({ where, data }: { where: { id: string }; data: { name: string } }) => {
        const org = db.organizations.find((o) => o.id === where.id);
        if (org === undefined) throw new Error('org not found');
        org.name = data.name;
        return Promise.resolve(org);
      },
    },
    permissionGroup: {
      // Models the real `upsert` by `systemKey` — reuse the existing row
      // (refreshing its grants) instead of ever inserting a duplicate.
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { systemKey: string };
        update: { name: string; permissions: unknown; isSystem: boolean };
        create: { name: string; permissions: unknown; isSystem: boolean; systemKey: string };
      }) => {
        const existing = db.permissionGroups.find((g) => g.systemKey === where.systemKey);
        if (existing !== undefined) {
          existing.name = update.name;
          existing.permissions = update.permissions;
          existing.isSystem = update.isSystem;
          return Promise.resolve(existing);
        }
        const group = {
          id: `pg-${create.systemKey}`,
          systemKey: create.systemKey,
          name: create.name,
          permissions: create.permissions,
          isSystem: create.isSystem,
        };
        db.permissionGroups.push(group);
        return Promise.resolve(group);
      },
    },
  };
}
type Tx = ReturnType<typeof makeTx>;

function makePrisma(db: SharedDb) {
  return {
    user: {
      count: () => Promise.resolve(db.users.length),
    },
    $transaction: async <T>(cb: (tx: Tx) => Promise<T>): Promise<T> => {
      const tx = makeTx(db);
      try {
        return await cb(tx);
      } finally {
        releaseLock(db);
      }
    },
  };
}

function caller(db: SharedDb) {
  const ctx = {
    prisma: makePrisma(db) as unknown as TRPCContext['prisma'],
    session: null,
    userId: null,
    permissions: new Set(),
  } satisfies TRPCContext;
  return createCallerFactory(setupRouter)(ctx);
}

const validInput = {
  orgName: 'Acme',
  adminName: 'Ada',
  email: 'ada@example.com',
  password: 'password123',
  setupToken: SETUP_TOKEN,
};

describe('setup.createFirstAdmin', () => {
  beforeEach(() => {
    delete process.env.SETUP_TOKEN;
  });
  afterEach(() => {
    delete process.env.SETUP_TOKEN;
  });

  it('throws PRECONDITION_FAILED when SETUP_TOKEN is unset — no user created', async () => {
    const db = createSharedDb();
    const c = caller(db);
    await expect(c.createFirstAdmin(validInput)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(db.users).toHaveLength(0);
  });

  it('throws UNAUTHORIZED on a wrong token — no user created', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();
    const c = caller(db);
    await expect(
      c.createFirstAdmin({ ...validInput, setupToken: 'wrong-token' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.users).toHaveLength(0);
  });

  it('creates the owner exactly once on a correct token against a fresh DB', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();
    const c = caller(db);
    const result = await c.createFirstAdmin(validInput);
    expect(result.ok).toBe(true);
    expect(db.users).toHaveLength(1);
    expect(db.users[0]?.email).toBe('ada@example.com');
    expect(db.organizations).toHaveLength(1);
    // Fresh-DB path unchanged: every system role gets its own PermissionGroup.
    expect(db.permissionGroups).toHaveLength(SYSTEM_ROLE_ORDER.length);
    const ownerGroup = db.permissionGroups.find((g) => g.systemKey === 'owner_admin');
    expect(ownerGroup).toBeDefined();
    expect(db.users[0]?.roleId).toBe(ownerGroup?.id);
  });

  // AUDIT (ORQ, 2026-10-10): createFirstAdmin used to unconditionally `create`
  // a PermissionGroup per system role. `systemKey` is `@unique`, and the db
  // seed's `seedSystemRoles()` upserts the SAME rows — so on a pre-seeded DB
  // (dev compose, or any install where the seed ran first) the blind create
  // threw a unique-constraint violation and rolled back the WHOLE
  // transaction, including the admin user. Setup must reuse (upsert) the
  // existing rows instead.
  it('reuses pre-seeded system-role PermissionGroups instead of duplicate-creating them', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();
    for (const role of SYSTEM_ROLE_ORDER) {
      db.permissionGroups.push({
        id: `seeded-${role}`,
        systemKey: role,
        name: 'stale-seed-name',
        permissions: [],
        isSystem: true,
      });
    }

    const c = caller(db);
    const result = await c.createFirstAdmin(validInput);

    expect(result.ok).toBe(true);
    // No transaction rollback: the admin user + org were created.
    expect(db.users).toHaveLength(1);
    expect(db.organizations).toHaveLength(1);
    // No duplicate rows — still exactly one PermissionGroup per system role,
    // reusing the SAME ids the seed created.
    expect(db.permissionGroups).toHaveLength(SYSTEM_ROLE_ORDER.length);
    expect(db.permissionGroups.map((g) => g.id).sort()).toEqual(
      SYSTEM_ROLE_ORDER.map((role) => `seeded-${role}`).sort(),
    );
    // Grants refreshed from the canonical source, not left stale.
    const ownerGroup = db.permissionGroups.find((g) => g.systemKey === 'owner_admin');
    expect(ownerGroup?.name).not.toBe('stale-seed-name');
    // The admin user is assigned the EXISTING (reused) owner_admin role id.
    expect(db.users[0]?.roleId).toBe('seeded-owner_admin');
  });

  // Regression: first-run setup used to unconditionally INSERT a new
  // Organization row, even when one already existed (e.g. the dev seed's
  // 'org_default') — producing two Organization rows and a settings
  // read/write that could silently hit different rows.
  it('reuses an existing Organization row (e.g. a dev seed) instead of creating a second', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();
    db.organizations.push({ id: 'org_default', name: 'My Firm' });

    const c = caller(db);
    await c.createFirstAdmin(validInput);

    expect(db.organizations).toHaveLength(1);
    expect(db.organizations[0]).toMatchObject({ id: 'org_default', name: 'Acme' });
  });

  it('rejects a second setup attempt once one owner already exists', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();
    await caller(db).createFirstAdmin(validInput);
    await expect(caller(db).createFirstAdmin(validInput)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(db.users).toHaveLength(1);
  });

  it('concurrency: two interleaved calls race for the advisory lock — exactly one owner created, the other CONFLICTs', async () => {
    process.env.SETUP_TOKEN = SETUP_TOKEN;
    const db = createSharedDb();

    const [first, second] = await Promise.allSettled([
      caller(db).createFirstAdmin({ ...validInput, email: 'first@example.com' }),
      caller(db).createFirstAdmin({ ...validInput, email: 'second@example.com' }),
    ]);

    const outcomes = [first, second];
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });

    // The authoritative guard is the in-transaction recheck under the lock —
    // regardless of which request won the race, exactly one owner exists.
    expect(db.users).toHaveLength(1);
  });
});
