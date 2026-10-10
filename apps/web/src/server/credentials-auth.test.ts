// TDD for the brute-force gate behind the WEB credentials login (Auth.js
// Credentials provider `authorize`). Audit H-3: the web login had no
// rate-limit at all — this pins it to the SAME store/logic the mobile
// bearer-login route already uses (apps/web/src/server/rate-limit.ts).
import { describe, expect, it } from 'vitest';
import { createMemoryStore, type RateLimitStore } from './rate-limit';
import { authorizeCredentials, type CredentialsAuthDeps } from './credentials-auth';

// Module-level default from rate-limit.ts (no env override in tests).
const EMAIL_MAX = 5;

const USER = {
  id: 'u1',
  name: 'Test User',
  email: 'user@example.com',
  isActive: true,
  passwordHash: 'irrelevant-hash',
};

function frozenStore(): RateLimitStore {
  return createMemoryStore(() => 1_000_000);
}

function req(ip: string): Request {
  return new Request('http://localhost/api/auth/callback/credentials', {
    headers: { 'x-forwarded-for': ip },
  });
}

function deps(opts: {
  store: RateLimitStore;
  passwordOk: boolean;
  user?: typeof USER | null;
}): CredentialsAuthDeps {
  return {
    store: opts.store,
    findUserByEmail: () => Promise.resolve(opts.user === undefined ? USER : opts.user),
    verifyPassword: () => Promise.resolve(opts.passwordOk),
  };
}

describe('authorizeCredentials — web login brute-force gate (audit H-3)', () => {
  it('rejects wrong password and returns null', async () => {
    const store = frozenStore();
    const result = await authorizeCredentials(
      deps({ store, passwordOk: false }),
      { email: USER.email, password: 'wrong' },
      req('203.0.113.1'),
    );
    expect(result).toBeNull();
  });

  it('accepts correct credentials', async () => {
    const store = frozenStore();
    const result = await authorizeCredentials(
      deps({ store, passwordOk: true }),
      { email: USER.email, password: 'correct' },
      req('203.0.113.2'),
    );
    expect(result).toEqual({ id: USER.id, name: USER.name, email: USER.email });
  });

  it('locks further attempts after EMAIL_MAX consecutive failed web logins', async () => {
    const store = frozenStore();
    const email = 'attacker@example.com';

    // EMAIL_MAX failed attempts — each still evaluated (not yet blocked).
    for (let i = 0; i < EMAIL_MAX; i++) {
      const result = await authorizeCredentials(
        deps({ store, passwordOk: false }),
        { email, password: 'wrong' },
        req('198.51.100.1'),
      );
      expect(result).toBeNull();
    }

    // The next attempt — even with the CORRECT password — is blocked by the
    // rate limiter BEFORE the password is ever checked.
    const blocked = await authorizeCredentials(
      deps({ store, passwordOk: true }),
      { email, password: 'correct' },
      req('198.51.100.1'),
    );
    expect(blocked).toBeNull();
  });

  it('a successful login resets the failure counter so later failures start from zero', async () => {
    const store = frozenStore();
    const email = 'user2@example.com';

    for (let i = 0; i < EMAIL_MAX - 1; i++) {
      await authorizeCredentials(
        deps({ store, passwordOk: false }),
        { email, password: 'wrong' },
        req('192.0.2.1'),
      );
    }

    // Succeed before reaching EMAIL_MAX — clears the counter.
    const success = await authorizeCredentials(
      deps({ store, passwordOk: true }),
      { email, password: 'correct' },
      req('192.0.2.1'),
    );
    expect(success).not.toBeNull();

    // EMAIL_MAX-1 more failures afterward are still allowed (counter restarted
    // from zero) — proves the reset actually happened, not just a no-op.
    for (let i = 0; i < EMAIL_MAX - 1; i++) {
      const result = await authorizeCredentials(
        deps({ store, passwordOk: false }),
        { email, password: 'wrong' },
        req('192.0.2.1'),
      );
      expect(result).toBeNull();
    }
    const stillAllowed = await authorizeCredentials(
      deps({ store, passwordOk: true }),
      { email, password: 'correct' },
      req('192.0.2.1'),
    );
    expect(stillAllowed).not.toBeNull();
  });

  it('rejects an invalid credentials shape without ever calling findUserByEmail', async () => {
    const store = frozenStore();
    let called = false;
    const d: CredentialsAuthDeps = {
      store,
      findUserByEmail: () => {
        called = true;
        return Promise.resolve(USER);
      },
      verifyPassword: () => Promise.resolve(true),
    };
    const result = await authorizeCredentials(
      d,
      { email: 'not-an-email', password: '' },
      req('203.0.113.9'),
    );
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it('rejects an inactive user', async () => {
    const store = frozenStore();
    const result = await authorizeCredentials(
      deps({ store, passwordOk: true, user: { ...USER, isActive: false } }),
      { email: USER.email, password: 'correct' },
      req('203.0.113.3'),
    );
    expect(result).toBeNull();
  });
});
