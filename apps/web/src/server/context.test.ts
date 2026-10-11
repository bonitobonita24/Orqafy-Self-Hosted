// H-2 regression: a deactivated user's Auth.js cookie session must resolve to
// NO user and NO permissions (treated as unauthenticated), not a stale
// authenticated context carried from login time.
// L-2 regression: a cookie session whose immutable sign-in time (authTime)
// predates the user's last password change must likewise resolve to NO
// user/session.
import { describe, expect, it, vi } from 'vitest';
import type { Permission } from '@orqafy/shared';
import type { Session } from 'next-auth';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('../auth', () => ({ auth: authMock }));

vi.mock('./bearer-identity', () => ({
  // No Authorization header in these tests — always fall through to the cookie path.
  resolveBearerIdentity: () => Promise.resolve(null),
}));

// Permission resolution hits Prisma for real; stub it so these tests assert
// only the isActive/authTime gating, not RBAC resolution (covered elsewhere).
vi.mock('./permissions', () => ({
  resolveUserPermissions: () => Promise.resolve(new Set<Permission>(['manage_files'])),
}));

const { createTRPCContext } = await import('./context');

function session(userId: string, authTime?: number): Session {
  const base: Session = { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' };
  return authTime !== undefined ? { ...base, authTime } : base;
}

describe('createTRPCContext — cookie-session isActive re-check (H-2)', () => {
  it('resolves to no user/session when the cookie-session user is deactivated', async () => {
    authMock.mockResolvedValue(session('u1'));
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: false, passwordChangedAt: null }),
    });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
    expect(ctx.permissions.size).toBe(0);
  });

  it('keeps the user/session when the cookie-session user is active', async () => {
    authMock.mockResolvedValue(session('u1'));
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });

    expect(ctx.userId).toBe('u1');
    expect(ctx.session?.user.id).toBe('u1');
  });

  it('resolves to no user when there is no cookie session at all', async () => {
    authMock.mockResolvedValue(null);
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
  });
});

describe('createTRPCContext — cookie-session passwordChangedAt re-check (L-2 web)', () => {
  it('rejects a session issued BEFORE the password change', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z'); // epoch sec 1767225610
    const issuedBefore = Math.floor(changedAt.getTime() / 1000) - 5;
    authMock.mockResolvedValue(session('u1', issuedBefore));
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
  });

  it('keeps a session issued AFTER the password change', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const issuedAfter = Math.floor(changedAt.getTime() / 1000) + 5;
    authMock.mockResolvedValue(session('u1', issuedAfter));
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });

    expect(ctx.userId).toBe('u1');
  });

  it('keeps a session issued in the SAME second as the password change (>=, not >)', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const issuedAtSameSecond = Math.floor(changedAt.getTime() / 1000);
    authMock.mockResolvedValue(session('u1', issuedAtSameSecond));
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });

    expect(ctx.userId).toBe('u1');
  });

  it('keeps the session when passwordChangedAt is null (back-compat, never changed)', async () => {
    authMock.mockResolvedValue(session('u1')); // no authTime
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });

    expect(ctx.userId).toBe('u1');
  });

  it('rejects (fail-closed) when authTime is missing but passwordChangedAt is set', async () => {
    authMock.mockResolvedValue(session('u1')); // no authTime
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const ctx = await createTRPCContext(undefined, {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
  });
});
