// AUDIT M-1 regression coverage: createFirstAdmin must (a) refuse to run when
// SETUP_TOKEN is unset, (b) reject a wrong token, (c) create exactly one owner
// on a correct token against a fresh DB, and (d) stay race-safe under two
// concurrent first-run attempts — the advisory lock inside the transaction is
// modeled as a serializing mutex over a shared in-memory user store so only
// one of two interleaved calls can ever create the owner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

vi.mock('../../lib/password', () => ({
  hashPassword: (plain: string) => Promise.resolve(`hashed:${plain}`),
}));

const { setupRouter } = await import('./setup');

const SETUP_TOKEN = 'test-setup-token-xxxxxxxxxxxxxxxx';

/** A shared in-memory "database" + advisory-lock mutex for one test's DB. */
function createSharedDb() {
  return {
    users: [] as Array<{ id: string; email: string }>,
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
      create: ({ data }: { data: { email: string } }) => {
        const user = { id: `u${++db.nextId}`, email: data.email };
        db.users.push(user);
        return Promise.resolve(user);
      },
    },
    organization: {
      create: () => Promise.resolve({ id: 'org1' }),
    },
    permissionGroup: {
      create: ({ data }: { data: { systemKey: string } }) =>
        Promise.resolve({ id: `pg-${data.systemKey}` }),
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
