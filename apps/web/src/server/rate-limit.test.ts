import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkLoginRateLimit,
  checkPhotoUploadRateLimit,
  clientIp,
  createMemoryStore,
  recordLoginFailure,
  recordLoginSuccess,
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

  it('blocks an email after EMAIL_MAX recorded failures', async () => {
    const store = frozenStore();
    const email = 'attacker@example.com';

    // Under threshold: still allowed.
    for (let i = 0; i < EMAIL_MAX - 1; i++) {
      await recordLoginFailure(store, email);
    }
    const stillOk = await checkLoginRateLimit(store, { ip: '198.51.100.1', email });
    expect(stillOk.allowed).toBe(true);

    // One more failure reaches the threshold → blocked.
    await recordLoginFailure(store, email);
    const blocked = await checkLoginRateLimit(store, { ip: '198.51.100.2', email });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(WINDOW_SEC);
  });

  it('recordLoginSuccess resets the email counter → allowed again', async () => {
    const store = frozenStore();
    const email = 'user@example.com';

    for (let i = 0; i < EMAIL_MAX; i++) {
      await recordLoginFailure(store, email);
    }
    const blocked = await checkLoginRateLimit(store, { ip: '192.0.2.1', email });
    expect(blocked.allowed).toBe(false);

    await recordLoginSuccess(store, email);
    const afterReset = await checkLoginRateLimit(store, { ip: '192.0.2.2', email });
    expect(afterReset.allowed).toBe(true);
  });

  it('email keys are canonicalized (trim + lowercase) consistently', async () => {
    const store = frozenStore();
    // Failures recorded under a messy-cased/spaced email…
    for (let i = 0; i < EMAIL_MAX; i++) {
      await recordLoginFailure(store, '  MixedCase@Example.COM ');
    }
    // …block the canonical form used by the route.
    const blocked = await checkLoginRateLimit(store, {
      ip: '192.0.2.9',
      email: 'mixedcase@example.com',
    });
    expect(blocked.allowed).toBe(false);
  });

  it('resets the counter once the window expires (injected clock)', async () => {
    let now = 0;
    const store = createMemoryStore(() => now);
    const key = 'rl:test:window';

    // First hit starts a 10s window; count climbs while inside it.
    expect(await store.incr(key, 10)).toBe(1);
    expect(await store.incr(key, 10)).toBe(2);
    expect(await store.get(key)).toBe(2);

    // Advance past the window → counter restarts.
    now += 10_001;
    expect(await store.get(key)).toBe(0);
    expect(await store.incr(key, 10)).toBe(1);
  });

  it('fails open when the store throws (never blocks a legit login)', async () => {
    const throwingStore: RateLimitStore = {
      incr(): Promise<number> {
        return Promise.reject(new Error('store down'));
      },
      get(): Promise<number> {
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
    expect(await store.get(ipKeyForTest(ip1))).toBe(2);
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
      incr: () => Promise.reject(new Error('store down')),
      get: () => Promise.reject(new Error('store down')),
      reset: () => Promise.reject(new Error('store down')),
    };
    expect(await checkPhotoUploadRateLimit(throwingStore, 'u1')).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });
});
