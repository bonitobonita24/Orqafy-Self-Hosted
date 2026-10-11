// Characterization tests for the mobile-bearer identity resolution that was
// extracted out of createTRPCContext so POST /api/photos can reuse it. Pins the
// behavior the tRPC context already had: Authorization-header only, verified
// token, and a FRESH isActive check (a stateless token is otherwise unrevocable).
import { describe, expect, it } from 'vitest';
import { resolveBearerIdentity, type BearerDeps } from './bearer-identity';

const ACTIVE = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@example.com',
  isActive: true,
  passwordChangedAt: null as Date | null,
};
const ISSUED_AT = 1_700_000_000; // arbitrary fixed epoch-seconds for 'good' tokens

function deps(overrides: Partial<BearerDeps> = {}): BearerDeps {
  return {
    verify: (t) =>
      Promise.resolve(t === 'good' ? { userId: 'u1', issuedAt: ISSUED_AT } : null),
    findUser: (id) => Promise.resolve(id === 'u1' ? ACTIVE : null),
    ...overrides,
  };
}

function req(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('authorization', authorization);
  return new Request('http://localhost/api/photos', { method: 'POST', headers });
}

describe('resolveBearerIdentity', () => {
  it('returns null when there is no request or no Authorization header', async () => {
    expect(await resolveBearerIdentity(undefined, deps())).toBeNull();
    expect(await resolveBearerIdentity(req(), deps())).toBeNull();
  });

  it('returns null for a non-Bearer scheme', async () => {
    expect(await resolveBearerIdentity(req('Basic good'), deps())).toBeNull();
  });

  it('returns null when the token fails verification', async () => {
    expect(await resolveBearerIdentity(req('Bearer bad'), deps())).toBeNull();
  });

  it('returns null for a deactivated user (fresh isActive re-check)', async () => {
    const d = deps({ findUser: () => Promise.resolve({ ...ACTIVE, isActive: false }) });
    expect(await resolveBearerIdentity(req('Bearer good'), d)).toBeNull();
  });

  it('returns null when the user no longer exists', async () => {
    const d = deps({ findUser: () => Promise.resolve(null) });
    expect(await resolveBearerIdentity(req('Bearer good'), d)).toBeNull();
  });

  it('returns the identity + a synthesized session for a valid active user', async () => {
    const id = await resolveBearerIdentity(req('Bearer good'), deps());
    expect(id?.userId).toBe('u1');
    expect(id?.session.user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@example.com' });
  });

  it('rejects a token issued BEFORE the last password change', async () => {
    const d = deps({
      findUser: () =>
        Promise.resolve({ ...ACTIVE, passwordChangedAt: new Date((ISSUED_AT + 60) * 1000) }),
    });
    expect(await resolveBearerIdentity(req('Bearer good'), d)).toBeNull();
  });

  it('accepts a token issued AFTER the last password change', async () => {
    const d = deps({
      findUser: () =>
        Promise.resolve({ ...ACTIVE, passwordChangedAt: new Date((ISSUED_AT - 60) * 1000) }),
    });
    const id = await resolveBearerIdentity(req('Bearer good'), d);
    expect(id?.userId).toBe('u1');
  });

  it('accepts a token issued in the SAME second as the password change', async () => {
    const d = deps({
      findUser: () =>
        Promise.resolve({ ...ACTIVE, passwordChangedAt: new Date(ISSUED_AT * 1000) }),
    });
    const id = await resolveBearerIdentity(req('Bearer good'), d);
    expect(id?.userId).toBe('u1');
  });

  it('passwordChangedAt === null leaves existing behavior unchanged', async () => {
    const id = await resolveBearerIdentity(req('Bearer good'), deps());
    expect(id?.userId).toBe('u1');
  });
});
