// H-2 regression: a deactivated user's Auth.js cookie session must resolve to
// NO user and NO permissions (treated as unauthenticated), not a stale
// authenticated context carried from login time.
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
// only the isActive gating, not RBAC resolution (covered elsewhere).
vi.mock('./permissions', () => ({
  resolveUserPermissions: () => Promise.resolve(new Set<Permission>(['manage_files'])),
}));

const { createTRPCContext } = await import('./context');

function session(userId: string): Session {
  return { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' };
}

describe('createTRPCContext — cookie-session isActive re-check (H-2)', () => {
  it('resolves to no user/session when the cookie-session user is deactivated', async () => {
    authMock.mockResolvedValue(session('u1'));
    const ctx = await createTRPCContext(undefined, { isUserActive: () => Promise.resolve(false) });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
    expect(ctx.permissions.size).toBe(0);
  });

  it('keeps the user/session when the cookie-session user is active', async () => {
    authMock.mockResolvedValue(session('u1'));
    const ctx = await createTRPCContext(undefined, { isUserActive: () => Promise.resolve(true) });

    expect(ctx.userId).toBe('u1');
    expect(ctx.session?.user.id).toBe('u1');
  });

  it('resolves to no user when there is no cookie session at all', async () => {
    authMock.mockResolvedValue(null);
    const ctx = await createTRPCContext(undefined, { isUserActive: () => Promise.resolve(true) });

    expect(ctx.userId).toBeNull();
    expect(ctx.session).toBeNull();
  });
});
