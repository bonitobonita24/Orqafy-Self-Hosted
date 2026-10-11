// authRouter.changePassword (ORQ-55 — self-service password change). Proves:
// wrong current password rejects (generic UNAUTHORIZED, no update call), and a
// correct current password updates passwordHash AND sets passwordChangedAt in
// the SAME update call (the L-2 invariant).
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

vi.mock('../../lib/password', () => ({
  hashPassword: (plain: string) => Promise.resolve(`hashed:${plain}`),
  verifyPassword: (plain: string, hash: string) =>
    Promise.resolve(hash === `hashed:${plain}`),
}));

const { authRouter } = await import('./auth');

interface UserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordChangedAt: Date | null;
  roleId: string;
}

interface Db {
  users: UserRow[];
  updateCalls: Array<{ where: { id: string }; data: Record<string, unknown> }>;
}

function createDb(): Db {
  return { users: [], updateCalls: [] };
}

function addUser(db: Db, overrides: Partial<UserRow> & { id: string }): UserRow {
  const user: UserRow = {
    name: 'User',
    email: `${overrides.id}@example.com`,
    passwordHash: 'hashed:old-password',
    passwordChangedAt: null,
    roleId: 'role-staff',
    ...overrides,
  };
  db.users.push(user);
  return user;
}

function makePrisma(db: Db) {
  return {
    user: {
      findUnique: ({ where }: { where: { id: string } }) => {
        const user = db.users.find((u) => u.id === where.id);
        return Promise.resolve(
          user === undefined ? null : { ...user, role: { name: 'Staff', systemKey: null } },
        );
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        db.updateCalls.push({ where, data });
        const user = db.users.find((u) => u.id === where.id);
        if (user === undefined) throw new Error('user not found');
        Object.assign(user, data);
        return Promise.resolve(user);
      },
    },
    auditLog: {
      create: ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'a1', ...data }),
    },
  };
}

function caller(db: Db, opts: { asUserId?: string } = {}) {
  const userId = opts.asUserId ?? 'user-1';
  const ctx = {
    prisma: makePrisma(db) as unknown as TRPCContext['prisma'],
    session: { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId,
    permissions: new Set<Permission>(),
  } satisfies TRPCContext;
  return createCallerFactory(authRouter)(ctx);
}

describe('auth.changePassword', () => {
  it('rejects a wrong current password with a generic UNAUTHORIZED and makes no update call', async () => {
    const db = createDb();
    addUser(db, { id: 'user-1', passwordHash: 'hashed:correct-password' });
    const c = caller(db, { asUserId: 'user-1' });

    await expect(
      c.changePassword({ currentPassword: 'wrong-password', newPassword: 'new-password-123' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(db.updateCalls).toHaveLength(0);
  });

  it('updates passwordHash AND sets passwordChangedAt in the same update call on success', async () => {
    const db = createDb();
    addUser(db, { id: 'user-1', passwordHash: 'hashed:correct-password' });
    const c = caller(db, { asUserId: 'user-1' });

    const result = await c.changePassword({
      currentPassword: 'correct-password',
      newPassword: 'new-password-123',
    });
    expect(result.ok).toBe(true);

    expect(db.updateCalls).toHaveLength(1);
    const call = db.updateCalls[0]!;
    expect(call.where).toEqual({ id: 'user-1' });
    expect(call.data.passwordHash).toBe('hashed:new-password-123');
    expect(call.data.passwordChangedAt).toBeInstanceOf(Date);

    const updated = db.users.find((u) => u.id === 'user-1')!;
    expect(updated.passwordHash).toBe('hashed:new-password-123');
    expect(updated.passwordChangedAt).toBeInstanceOf(Date);
  });
});

// W2b — rate-limit changePassword against brute-forcing the current-password
// check. Reuses the SAME store/shape as the login limiter (rate-limit.ts):
// `checkChangePasswordRateLimit` hits a per-user counter BEFORE the bcrypt
// check (so every attempt counts, same as login's per-email counter), and
// `recordChangePasswordSuccess` resets it on a successful change. Each test
// below uses its own userId so it never shares a counter window with another
// test in this file (the limiter is keyed per-user on the real process-wide
// store — see rate-limit.ts `getRateLimitStore()`).
describe('auth.changePassword — rate limit (ORQ-55 W2b)', () => {
  const CHANGE_PASSWORD_MAX = 5; // module default in rate-limit.ts, no env override in tests

  it('allows CHANGE_PASSWORD_MAX failed attempts, then blocks the next with TOO_MANY_REQUESTS', async () => {
    const db = createDb();
    const userId = 'rl-user-1';
    addUser(db, { id: userId, passwordHash: 'hashed:correct-password' });
    const c = caller(db, { asUserId: userId });

    for (let i = 0; i < CHANGE_PASSWORD_MAX; i++) {
      await expect(
        c.changePassword({ currentPassword: 'wrong-password', newPassword: 'new-password-123' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }

    // The next attempt is blocked by the rate limiter BEFORE the password is
    // ever checked — even with the CORRECT current password.
    await expect(
      c.changePassword({ currentPassword: 'correct-password', newPassword: 'new-password-123' }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    expect(db.updateCalls).toHaveLength(0);
  });

  it('a successful change resets the counter so later failures start from zero', async () => {
    const db = createDb();
    const userId = 'rl-user-2';
    addUser(db, { id: userId, passwordHash: 'hashed:correct-password' });
    const c = caller(db, { asUserId: userId });

    // A few failures, well under the limit.
    for (let i = 0; i < CHANGE_PASSWORD_MAX - 1; i++) {
      await expect(
        c.changePassword({ currentPassword: 'wrong-password', newPassword: 'new-password-123' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }

    // A successful change resets the counter.
    const result = await c.changePassword({
      currentPassword: 'correct-password',
      newPassword: 'new-password-123',
    });
    expect(result.ok).toBe(true);

    // The user's password is now `new-password-123` — CHANGE_PASSWORD_MAX
    // more failures (against the NEW password) are allowed again, proving
    // the counter started from zero after the reset.
    for (let i = 0; i < CHANGE_PASSWORD_MAX; i++) {
      await expect(
        c.changePassword({ currentPassword: 'still-wrong', newPassword: 'another-password-1' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }
  });
});
