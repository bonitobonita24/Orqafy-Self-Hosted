// H-2 regression: resolveRequestUserId's cookie-session fallback must re-check
// `isActive` fresh from the DB, same as the bearer path already does — a
// deactivated user's cookie session must resolve to no user id.
import { describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('../auth', () => ({ auth: authMock }));

vi.mock('./bearer-identity', () => ({
  // No Authorization header in these tests — always fall through to the cookie path.
  resolveBearerIdentity: () => Promise.resolve(null),
}));

const { resolveRequestUserId } = await import('./request-auth');

function session(userId: string): Session {
  return { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' };
}

function req(): Request {
  return new Request('http://localhost/api/media', { method: 'POST' });
}

describe('resolveRequestUserId — cookie-session isActive re-check (H-2)', () => {
  it('returns null when the cookie-session user is deactivated', async () => {
    authMock.mockResolvedValue(session('u1'));
    const id = await resolveRequestUserId(req(), { isUserActive: () => Promise.resolve(false) });
    expect(id).toBeNull();
  });

  it('returns the user id when the cookie-session user is active', async () => {
    authMock.mockResolvedValue(session('u1'));
    const id = await resolveRequestUserId(req(), { isUserActive: () => Promise.resolve(true) });
    expect(id).toBe('u1');
  });

  it('returns null when there is no cookie session at all', async () => {
    authMock.mockResolvedValue(null);
    const id = await resolveRequestUserId(req(), { isUserActive: () => Promise.resolve(true) });
    expect(id).toBeNull();
  });
});
