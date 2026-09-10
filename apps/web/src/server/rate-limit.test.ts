import { describe, expect, it } from 'vitest';
import {
  checkLoginRateLimit,
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
