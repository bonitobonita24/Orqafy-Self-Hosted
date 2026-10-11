import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkChangePasswordRateLimit,
  checkLoginRateLimit,
  checkPhotoUploadRateLimit,
  clientIp,
  createMemoryStore,
  recordChangePasswordSuccess,
  recordLoginSuccess,
  resolveRateLimitBackendUrl,
  withMemoryFallback,
  type RateLimitStore,
} from './rate-limit';

// The config thresholds are module-level constants read from env at import time;
// with no env overrides these are the documented defaults. Tests assert against
// them directly so they stay in lockstep with the source.
const IP_MAX = 20;
const EMAIL_MAX = 5;
const WINDOW_SEC = 900;

// A frozen clock: entries never expire mid-test, so threshold logic is
// deterministic regardless of wall-clock time.
function frozenStore(): RateLimitStore {
  return createMemoryStore(() => 1_000_000);
}

describe('rate-limit', () => {
  it('allows IP attempts under the limit and blocks the (IP_MAX+1)th', async () => {
    const store = frozenStore();
    const args = { ip: '203.0.113.7', email: null };

    for (let i = 0; i < IP_MAX; i++) {
      const rl = await checkLoginRateLimit(store, args);
      expect(rl.allowed).toBe(true);
    }

    const blocked = await checkLoginRateLimit(store, args);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBe(WINDOW_SEC);
  });

  // audit fix: checkLoginRateLimit now consumes the email counter ATOMICALLY
  // via hit() up front (same mechanism as the IP counter) instead of only
  // peek()ing it here and relying on a later, separately-timed
  // recordLoginFailure() call to increment it — that split was itself a
  // TOCTOU (N concurrent requests for the same email could all peek() the
  // same under-limit count before any of them incremented it). The allowed-
  // attempt count is unchanged: EMAIL_MAX attempts allowed, the
  // (EMAIL_MAX+1)th blocked — same as before the fix, same shape as the IP
  // test above.
  it('allows EMAIL_MAX attempts for one email and blocks the (EMAIL_MAX+1)th', async () => {
    const store = frozenStore();
    const email = 'attacker@example.com';

    for (let i = 0; i < EMAIL_MAX; i++) {
      const rl = await checkLoginRateLimit(store, { ip: `198.51.100.${i + 1}`, email });
      expect(rl.allowed).toBe(true);
    }

    const blocked = await checkLoginRateLimit(store, { ip: '198.51.100.99', email });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(WINDOW_SEC);
  });

  it('recordLoginSuccess resets the email counter → allowed again', async () => {
    const store = frozenStore();
    const email = 'user@example.com';

    for (let i = 0; i < EMAIL_MAX; i++) {
      await checkLoginRateLimit(store, { ip: `192.0.2.${i + 1}`, email });
    }
    const blocked = await checkLoginRateLimit(store, { ip: '192.0.2.50', email });
    expect(blocked.allowed).toBe(false);

    await recordLoginSuccess(store, email);
    const afterReset = await checkLoginRateLimit(store, { ip: '192.0.2.51', email });
    expect(afterReset.allowed).toBe(true);
  });

  it('email keys are canonicalized (trim + lowercase) consistently', async () => {
    const store = frozenStore();
    // EMAIL_MAX attempts recorded under a messy-cased/spaced email…
    for (let i = 0; i < EMAIL_MAX; i++) {
      await checkLoginRateLimit(store, {
        ip: `192.0.2.${100 + i}`,
        email: '  MixedCase@Example.COM ',
      });
    }
    // …block the canonical form used by the route.
    const blocked = await checkLoginRateLimit(store, {
      ip: '192.0.2.9',
      email: 'mixedcase@example.com',
    });
    expect(blocked.allowed).toBe(false);
  });

  it('50 "concurrent" checkLoginRateLimit calls for one email allow exactly EMAIL_MAX (closes the email TOCTOU)', async () => {
    const store = frozenStore();
    const email = 'race@example.com';
    const N = 50;

    // Distinct IPs so only the EMAIL_MAX gate can trigger a block here — the
    // per-IP counter (IP_MAX=20) never factors in since each IP is hit once.
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => checkLoginRateLimit(store, { ip: `10.0.0.${i}`, email })),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(EMAIL_MAX);
    for (const r of results) {
      if (!r.allowed) expect(r.retryAfterSec).toBe(WINDOW_SEC);
    }
  });

  it('resets the counter once the window expires (injected clock)', async () => {
    let now = 0;
    const store = createMemoryStore(() => now);
    const key = 'rl:test:window';

    // First hit starts a 10s window; count climbs while inside it.
    expect((await store.hit(key, 10_000)).count).toBe(1);
    expect((await store.hit(key, 10_000)).count).toBe(2);
    expect((await store.peek(key))?.count).toBe(2);

    // Advance past the window → counter restarts.
    now += 10_001;
    expect(await store.peek(key)).toBeNull();
    expect((await store.hit(key, 10_000)).count).toBe(1);
  });

  it('hit() is atomic — no separate read-then-write for concurrent callers to race', async () => {
    // Drives N "concurrent" (same microtask-queued) hits against ONE key and
    // asserts the final count is exactly N — the regression this store
    // exists to prevent is two racing increments both reading a stale count
    // and under-counting. The in-memory store's `hit` has no `await` between
    // its read and its write, so every one of these resolves synchronously
    // in registration order with no interleaving.
    const store = createMemoryStore(() => 1_000_000);
    const key = 'rl:test:concurrency';
    const N = 50;

    const results = await Promise.all(Array.from({ length: N }, () => store.hit(key, 10_000)));

    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    expect((await store.peek(key))?.count).toBe(N);
  });

  it('hit() resetAt stays fixed within a window and only establishes TTL on the first hit', async () => {
    const store = createMemoryStore(() => 1_000_000);
    const key = 'rl:test:resetAt';

    const first = await store.hit(key, 5_000);
    const second = await store.hit(key, 5_000);
    expect(first.resetAt).toBe(1_000_000 + 5_000);
    expect(second.resetAt).toBe(first.resetAt);
  });

  it('peek() never mutates the counter', async () => {
    const store = createMemoryStore(() => 1_000_000);
    const key = 'rl:test:peek-readonly';

    await store.hit(key, 10_000);
    await store.peek(key);
    await store.peek(key);
    expect((await store.peek(key))?.count).toBe(1);
  });

  it('fails open when the store throws (never blocks a legit login)', async () => {
    const throwingStore: RateLimitStore = {
      hit(): Promise<{ count: number; resetAt: number }> {
        return Promise.reject(new Error('store down'));
      },
      peek(): Promise<{ count: number; resetAt: number } | null> {
        return Promise.reject(new Error('store down'));
      },
      reset(): Promise<void> {
        return Promise.reject(new Error('store down'));
      },
    };

    const rl = await checkLoginRateLimit(throwingStore, {
      ip: '203.0.113.99',
      email: 'someone@example.com',
    });
    expect(rl.allowed).toBe(true);
    expect(rl.retryAfterSec).toBe(0);
  });
});

describe('withMemoryFallback', () => {
  function throwingStore(): RateLimitStore {
    return {
      hit: () => Promise.reject(new Error('valkey down')),
      peek: () => Promise.reject(new Error('valkey down')),
      reset: () => Promise.reject(new Error('valkey down')),
    };
  }

  it('falls back to the fallback store on hit() when primary throws', async () => {
    const fallback = createMemoryStore(() => 1_000_000);
    const store = withMemoryFallback(throwingStore(), fallback);

    const result = await store.hit('rl:test:fb-a', 10_000);
    expect(result.count).toBe(1);
    // The fallback's own state was actually mutated, not just a one-off value.
    expect((await fallback.peek('rl:test:fb-a'))?.count).toBe(1);
  });

  it('falls back on peek() and reset() too', async () => {
    const fallback = createMemoryStore(() => 1_000_000);
    const store = withMemoryFallback(throwingStore(), fallback);

    await fallback.hit('rl:test:fb-b', 10_000);
    expect((await store.peek('rl:test:fb-b'))?.count).toBe(1);

    await store.reset('rl:test:fb-b');
    expect(await fallback.peek('rl:test:fb-b')).toBeNull();
  });

  it('never throws even when both the primary error path and fallback succeed', async () => {
    const fallback = createMemoryStore(() => 1_000_000);
    const store = withMemoryFallback(throwingStore(), fallback);

    await expect(store.hit('rl:test:fb-c', 10_000)).resolves.toBeDefined();
  });

  it('uses the primary store directly when it succeeds (no fallback mutation)', async () => {
    const primary = createMemoryStore(() => 1_000_000);
    const fallback = createMemoryStore(() => 1_000_000);
    const store = withMemoryFallback(primary, fallback);

    await store.hit('rl:test:fb-d', 10_000);
    expect((await primary.peek('rl:test:fb-d'))?.count).toBe(1);
    expect(await fallback.peek('rl:test:fb-d')).toBeNull();
  });
});

// clientIp (audit M-2): must resolve the TRUSTED proxy hop, never the
// client-spoofable leftmost X-Forwarded-For entry.
function reqWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/mobile/login', { headers });
}

describe('clientIp', () => {
  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  afterEach(() => {
    delete process.env.TRUSTED_PROXY_HOPS;
  });

  it('(a) single trusted proxy (default hops=1): resolves the sole XFF entry', () => {
    const req = reqWithHeaders({ 'x-forwarded-for': '203.0.113.9' });
    expect(clientIp(req)).toBe('203.0.113.9');
  });

  it('(b) SPOOF: ignores a client-prepended fake leftmost entry, trusts the proxy-appended rightmost one', () => {
    // Attacker sets "X-Forwarded-For: 1.2.3.4" before reaching the proxy; the
    // proxy appends the real peer IP to the right.
    const req = reqWithHeaders({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });
    const resolved = clientIp(req);
    expect(resolved).toBe('203.0.113.9');
    expect(resolved).not.toBe('1.2.3.4');
  });

  it('(c) rotating-spoof evasion is defeated: different fake left entries, same real rightmost IP → same clientIp, shared rate-limit bucket', async () => {
    const req1 = reqWithHeaders({ 'x-forwarded-for': 'aaa.fake.1, 203.0.113.50' });
    const req2 = reqWithHeaders({ 'x-forwarded-for': 'zzz.fake.2, 203.0.113.50' });

    const ip1 = clientIp(req1);
    const ip2 = clientIp(req2);
    expect(ip1).toBe(ip2);
    expect(ip1).toBe('203.0.113.50');

    // Drive both through the real limiter store and confirm they land in the
    // SAME per-IP bucket (an attacker rotating the spoofed entry cannot reset
    // or evade the counter).
    const store = frozenStore();
    const r1 = await checkLoginRateLimit(store, { ip: ip1, email: null });
    const r2 = await checkLoginRateLimit(store, { ip: ip2, email: null });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect((await store.peek(ipKeyForTest(ip1)))?.count).toBe(2);
  });

  it('(d) TRUSTED_PROXY_HOPS=2 resolves the 2nd-from-right entry (the hop before the edge proxy)', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    const req = reqWithHeaders({ 'x-forwarded-for': 'fake, realclient, proxy1' });
    expect(clientIp(req)).toBe('realclient');
  });

  it('(e) falls back to x-real-ip when XFF is absent, then to "unknown" with no headers', () => {
    const reqRealIp = reqWithHeaders({ 'x-real-ip': '198.51.100.7' });
    expect(clientIp(reqRealIp)).toBe('198.51.100.7');

    const reqNone = reqWithHeaders({});
    expect(clientIp(reqNone)).toBe('unknown');
  });
});

// Mirrors the private `ipKey()` helper in rate-limit.ts (not exported) so the
// rotating-spoof test can assert the underlying store bucket directly.
function ipKeyForTest(ip: string): string {
  return `rl:mlogin:ip:${ip}`;
}

// Photo-upload limiter (F3): per-user, defaults 60 per 600 s.
const PHOTO_MAX = 60;
const PHOTO_WINDOW_SEC = 600;

describe('checkPhotoUploadRateLimit', () => {
  it('allows PHOTO_MAX uploads per user and blocks the next with Retry-After', async () => {
    const store = frozenStore();
    for (let i = 0; i < PHOTO_MAX; i++) {
      expect((await checkPhotoUploadRateLimit(store, 'u1')).allowed).toBe(true);
    }
    const blocked = await checkPhotoUploadRateLimit(store, 'u1');
    expect(blocked).toEqual({ allowed: false, retryAfterSec: PHOTO_WINDOW_SEC });
  });

  it('counts each user separately', async () => {
    const store = frozenStore();
    for (let i = 0; i < PHOTO_MAX + 1; i++) await checkPhotoUploadRateLimit(store, 'u1');
    expect((await checkPhotoUploadRateLimit(store, 'u2')).allowed).toBe(true);
  });

  it('does not share counters with the login limiter', async () => {
    const store = frozenStore();
    for (let i = 0; i < PHOTO_MAX + 1; i++) await checkPhotoUploadRateLimit(store, 'u1');
    expect((await checkLoginRateLimit(store, { ip: 'u1', email: null })).allowed).toBe(true);
  });

  it('fails open when the store throws', async () => {
    const throwingStore: RateLimitStore = {
      hit: () => Promise.reject(new Error('store down')),
      peek: () => Promise.reject(new Error('store down')),
      reset: () => Promise.reject(new Error('store down')),
    };
    expect(await checkPhotoUploadRateLimit(throwingStore, 'u1')).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });
});

// checkChangePasswordRateLimit (ORQ-55 W2b) — same shape/thresholds as the
// login email-counter tests above (CHANGE_PASSWORD_MAX defaults to EMAIL_MAX),
// keyed per-user instead of per-email since the caller is already
// authenticated.
describe('checkChangePasswordRateLimit', () => {
  const CHANGE_PASSWORD_MAX = 5; // module default, no env override in tests

  it('allows CHANGE_PASSWORD_MAX attempts for one user and blocks the (MAX+1)th', async () => {
    const store = frozenStore();
    const userId = 'user-abc';

    for (let i = 0; i < CHANGE_PASSWORD_MAX; i++) {
      const rl = await checkChangePasswordRateLimit(store, userId);
      expect(rl.allowed).toBe(true);
    }

    const blocked = await checkChangePasswordRateLimit(store, userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('a different user has an independent counter', async () => {
    const store = frozenStore();

    for (let i = 0; i < CHANGE_PASSWORD_MAX; i++) {
      await checkChangePasswordRateLimit(store, 'user-a');
    }
    const blockedA = await checkChangePasswordRateLimit(store, 'user-a');
    expect(blockedA.allowed).toBe(false);

    const allowedB = await checkChangePasswordRateLimit(store, 'user-b');
    expect(allowedB.allowed).toBe(true);
  });

  it('recordChangePasswordSuccess resets the counter → allowed again', async () => {
    const store = frozenStore();
    const userId = 'user-xyz';

    for (let i = 0; i < CHANGE_PASSWORD_MAX; i++) {
      await checkChangePasswordRateLimit(store, userId);
    }
    const blocked = await checkChangePasswordRateLimit(store, userId);
    expect(blocked.allowed).toBe(false);

    await recordChangePasswordSuccess(store, userId);
    const afterReset = await checkChangePasswordRateLimit(store, userId);
    expect(afterReset.allowed).toBe(true);
  });

  it('fails open on a store error', async () => {
    const throwingStore: RateLimitStore = {
      hit: () => Promise.reject(new Error('boom')),
      peek: () => Promise.reject(new Error('boom')),
      reset: () => Promise.reject(new Error('boom')),
    };
    expect(await checkChangePasswordRateLimit(throwingStore, 'user-1')).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });
});

// Cross-scope note: packages/jobs/src/connection.ts (connectionFromEnv) uses
// the same VALKEY_URL ?? REDIS_URL precedence for BullMQ. Keep the two in
// lockstep — an installer setting only REDIS_URL must get Valkey-backed
// behavior in BOTH the job queue and the rate limiter, never just one.
describe('resolveRateLimitBackendUrl (VALKEY_URL / REDIS_URL fallback precedence)', () => {
  it('neither set → undefined (selects the in-memory store)', () => {
    expect(resolveRateLimitBackendUrl({})).toBeUndefined();
  });

  it('REDIS_URL only → used (does not silently fall back to in-memory)', () => {
    expect(resolveRateLimitBackendUrl({ REDIS_URL: 'redis://redis-host:6379' })).toBe(
      'redis://redis-host:6379',
    );
  });

  it('VALKEY_URL only → used', () => {
    expect(resolveRateLimitBackendUrl({ VALKEY_URL: 'redis://valkey-host:6379' })).toBe(
      'redis://valkey-host:6379',
    );
  });

  it('both set → VALKEY_URL wins', () => {
    expect(
      resolveRateLimitBackendUrl({
        VALKEY_URL: 'redis://valkey-host:6379',
        REDIS_URL: 'redis://redis-host:6379',
      }),
    ).toBe('redis://valkey-host:6379');
  });

  it('empty-string values are treated as unset', () => {
    expect(resolveRateLimitBackendUrl({ VALKEY_URL: '', REDIS_URL: '' })).toBeUndefined();
    expect(resolveRateLimitBackendUrl({ VALKEY_URL: '', REDIS_URL: 'redis://redis-host:6379' })).toBe(
      'redis://redis-host:6379',
    );
  });
});
