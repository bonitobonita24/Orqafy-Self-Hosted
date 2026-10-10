// usersRouter.erase (DPA W5, `.ai_prompt/privacy.md` dsr.erase) — controller-
// operated right-to-erasure, pseudonymize-in-place. Covers: permission gate,
// self-erase block, last-admin guard, idempotent already-erased rejection,
// PII scrub + retained records, and the audit write.
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

vi.mock('../../lib/password', () => ({
  hashPassword: (plain: string) => Promise.resolve(`hashed:${plain}`),
}));

const { usersRouter } = await import('./users');

interface RoleRow {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  systemKey: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  roleId: string;
  isActive: boolean;
  anonymizedAt: Date | null;
}

interface Db {
  users: UserRow[];
  roles: RoleRow[];
  notifications: Array<{ id: string; userId: string }>;
  leaveRequests: Array<{ id: string; userId: string; reason: string | null }>;
  auditRows: Array<Record<string, unknown>>;
}

function createDb(): Db {
  const adminRole: RoleRow = {
    id: 'role-admin',
    name: 'Owner Admin',
    permissions: ['manage_users', 'configure_server'],
    isSystem: true,
    systemKey: 'owner_admin',
  };
  const staffRole: RoleRow = {
    id: 'role-staff',
    name: 'Field Staff',
    permissions: ['upload_photo'],
    isSystem: true,
    systemKey: 'field_staff',
  };
  return {
    users: [],
    roles: [adminRole, staffRole],
    notifications: [],
    leaveRequests: [],
    auditRows: [],
  };
}

function addUser(
  db: Db,
  overrides: Partial<UserRow> & { id: string; roleId: string },
): UserRow {
  const user: UserRow = {
    name: 'User',
    email: `${overrides.id}@example.com`,
    phone: '555-0000',
    passwordHash: 'original-hash',
    isActive: true,
    anonymizedAt: null,
    ...overrides,
  };
  db.users.push(user);
  return user;
}

function withRole(db: Db, user: UserRow) {
  const role = db.roles.find((r) => r.id === user.roleId);
  if (role === undefined) throw new Error('role not found');
  return { ...user, role, groups: [], overrides: [] };
}

interface MockPrisma {
  user: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<(UserRow & { role: RoleRow; groups: never[]; overrides: never[] }) | null>;
    findMany: (args: {
      where: { id: { not: string }; isActive: boolean; anonymizedAt: null };
    }) => Promise<Array<UserRow & { role: RoleRow; groups: never[]; overrides: never[] }>>;
    update: (args: { where: { id: string }; data: Partial<UserRow> }) => Promise<UserRow>;
  };
  notification: {
    deleteMany: (args: { where: { userId: string } }) => Promise<{ count: number }>;
  };
  leaveRequest: {
    updateMany: (args: {
      where: { userId: string };
      data: { reason: null };
    }) => Promise<{ count: number }>;
  };
  auditLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  };
  $transaction: <T>(cb: (tx: MockPrisma) => Promise<T>) => Promise<T>;
}

function makePrisma(db: Db): MockPrisma {
  return {
    user: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const user = db.users.find((u) => u.id === where.id);
        return Promise.resolve(user === undefined ? null : withRole(db, user));
      },
      findMany: ({ where }: { where: { id: { not: string }; isActive: boolean; anonymizedAt: null } }) => {
        const rows = db.users
          .filter((u) => u.id !== where.id.not)
          .filter((u) => u.isActive === where.isActive)
          .filter((u) => u.anonymizedAt === where.anonymizedAt)
          .map((u) => withRole(db, u));
        return Promise.resolve(rows);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const user = db.users.find((u) => u.id === where.id);
        if (user === undefined) throw new Error('user not found');
        Object.assign(user, data);
        return Promise.resolve(user);
      },
    },
    notification: {
      deleteMany: ({ where }: { where: { userId: string } }) => {
        const before = db.notifications.length;
        db.notifications = db.notifications.filter((n) => n.userId !== where.userId);
        return Promise.resolve({ count: before - db.notifications.length });
      },
    },
    leaveRequest: {
      updateMany: ({ where, data }: { where: { userId: string }; data: { reason: null } }) => {
        let count = 0;
        for (const lr of db.leaveRequests) {
          if (lr.userId === where.userId) {
            lr.reason = data.reason;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    },
    auditLog: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        db.auditRows.push(data);
        return Promise.resolve({ id: `a${db.auditRows.length}`, ...data });
      },
    },
    $transaction: async <T>(cb: (tx: MockPrisma) => Promise<T>): Promise<T> => {
      // In-memory mock: no real isolation needed — just run the callback
      // against the same mock client so writes land on the shared `db`.
      return cb(makePrisma(db));
    },
  };
}

function caller(db: Db, opts: { asUserId?: string; permissions?: Permission[] } = {}) {
  const userId = opts.asUserId ?? 'admin-1';
  const ctx = {
    prisma: makePrisma(db) as unknown as TRPCContext['prisma'],
    session: { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId,
    permissions: new Set<Permission>(opts.permissions ?? ['manage_users']),
  } satisfies TRPCContext;
  return createCallerFactory(usersRouter)(ctx);
}

describe('users.erase', () => {
  it('rejects without manage_users', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const target = addUser(db, { id: 'staff-1', roleId: 'role-staff' });
    const c = caller(db, { permissions: [] });
    await expect(c.erase({ userId: target.id, confirm: true })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('blocks self-erase', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const c = caller(db);
    await expect(c.erase({ userId: 'admin-1', confirm: true })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('404s on an unknown target', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const c = caller(db);
    await expect(c.erase({ userId: 'ghost', confirm: true })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('enforces the last-admin guard — blocks erasing the sole remaining admin', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const solo = addUser(db, { id: 'admin-2', roleId: 'role-admin' });
    // admin-1 erases admin-2, who is the LAST remaining admin besides itself —
    // but admin-1 is also an admin, so admin-2 is not actually the last.
    // To exercise the guard, make admin-1 a non-admin caller erasing the sole admin.
    db.users.find((u) => u.id === 'admin-1')!.roleId = 'role-staff';
    const c = caller(db, { asUserId: 'admin-1', permissions: ['manage_users'] });
    await expect(c.erase({ userId: solo.id, confirm: true })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.users.find((u) => u.id === solo.id)?.anonymizedAt).toBeNull();
  });

  it('allows erasing an admin when another active admin remains', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const target = addUser(db, { id: 'admin-2', roleId: 'role-admin' });
    const c = caller(db, { asUserId: 'admin-1' });
    const result = await c.erase({ userId: target.id, confirm: true });
    expect(result.ok).toBe(true);
  });

  it('already-erased target is rejected idempotently, with no writes', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const target = addUser(db, {
      id: 'staff-1',
      roleId: 'role-staff',
      anonymizedAt: new Date('2026-01-01'),
      isActive: false,
    });
    const c = caller(db);
    await expect(c.erase({ userId: target.id, confirm: true })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(db.auditRows).toHaveLength(0);
  });

  it('scrubs PII, deactivates, deletes notifications, nulls leave reasons, retains AuditLog, writes audit', async () => {
    const db = createDb();
    addUser(db, { id: 'admin-1', roleId: 'role-admin' });
    const target = addUser(db, {
      id: 'staff-1',
      roleId: 'role-staff',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      passwordHash: 'real-hash',
    });
    db.notifications.push({ id: 'n1', userId: target.id }, { id: 'n2', userId: target.id });
    db.leaveRequests.push({ id: 'lr1', userId: target.id, reason: 'medical leave details' });
    db.auditRows.push({ id: 'pre1', userId: target.id, action: 'login', targetType: 'user' });

    const c = caller(db);
    const result = await c.erase({ userId: target.id, confirm: true });
    expect(result.ok).toBe(true);

    const updated = db.users.find((u) => u.id === target.id)!;
    expect(updated.name).toBe('Erased user');
    expect(updated.email).toBe(`erased+${target.id}@orqafy.invalid`);
    expect(updated.phone).toBeNull();
    expect(updated.passwordHash).not.toBe('real-hash');
    expect(updated.isActive).toBe(false);
    expect(updated.anonymizedAt).toBeInstanceOf(Date);

    expect(db.notifications).toHaveLength(0);
    expect(db.leaveRequests.find((lr) => lr.id === 'lr1')?.reason).toBeNull();

    // Pre-existing AuditLog row untouched, PLUS the new erasure audit row.
    expect(db.auditRows).toHaveLength(2);
    expect(db.auditRows[0]).toMatchObject({ id: 'pre1' });
    expect(db.auditRows[1]).toMatchObject({
      userId: 'admin-1',
      action: 'data_subject.erase',
      targetType: 'user',
      targetId: target.id,
      metadata: {},
    });
  });
});
