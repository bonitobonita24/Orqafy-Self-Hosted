// H-2 regression: resolveRequestUserId's cookie-session fallback must re-check
// `isActive` fresh from the DB, same as the bearer path already does — a
// deactivated user's cookie session must resolve to no user id.
// L-2 regression: likewise for a cookie session issued before a password change.
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('../auth', () => ({ auth: authMock }));

vi.mock('./bearer-identity', () => ({
  // No Authorization header in these tests — always fall through to the cookie path.
  resolveBearerIdentity: () => Promise.resolve(null),
}));

const { resolveRequestUserId } = await import('./request-auth');

function session(userId: string, iat?: number): Session {
  const base: Session = { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' };
  return iat !== undefined ? { ...base, iat } : base;
}

function req(): Request {
  return new Request('http://localhost/api/media', { method: 'POST' });
}

describe('resolveRequestUserId — cookie-session isActive re-check (H-2)', () => {
  it('returns null when the cookie-session user is deactivated', async () => {
    authMock.mockResolvedValue(session('u1'));
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: false, passwordChangedAt: null }),
    });
    expect(id).toBeNull();
  });

  it('returns the user id when the cookie-session user is active', async () => {
    authMock.mockResolvedValue(session('u1'));
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });
    expect(id).toBe('u1');
  });

  it('returns null when there is no cookie session at all', async () => {
    authMock.mockResolvedValue(null);
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });
    expect(id).toBeNull();
  });
});

describe('resolveRequestUserId — cookie-session passwordChangedAt re-check (L-2 web)', () => {
  it('returns null for a session issued BEFORE the password change', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const issuedBefore = Math.floor(changedAt.getTime() / 1000) - 5;
    authMock.mockResolvedValue(session('u1', issuedBefore));
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });
    expect(id).toBeNull();
  });

  it('returns the user id for a session issued AFTER the password change', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const issuedAfter = Math.floor(changedAt.getTime() / 1000) + 5;
    authMock.mockResolvedValue(session('u1', issuedAfter));
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });
    expect(id).toBe('u1');
  });

  it('returns the user id when passwordChangedAt is null (back-compat)', async () => {
    authMock.mockResolvedValue(session('u1')); // no iat
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: null }),
    });
    expect(id).toBe('u1');
  });

  it('returns null (fail-closed) when iat is missing but passwordChangedAt is set', async () => {
    authMock.mockResolvedValue(session('u1')); // no iat
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    const id = await resolveRequestUserId(req(), {
      getUserAuthState: () => Promise.resolve({ isActive: true, passwordChangedAt: changedAt }),
    });
    expect(id).toBeNull();
  });
});
