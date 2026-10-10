// Unit tests for the Valkey-backed RateLimitStore. Exercises the store
// against a hand-written fake implementing `MinimalRedisClient` — NOT a real
// Valkey connection and NOT ioredis-mock (not already a project dependency;
// the fake is narrower and keeps these tests dependency-free and fast). A
// one-off LIVE check against a real dev Valkey instance (if reachable) is
// run separately, outside the automated suite.
import { describe, expect, it, vi } from 'vitest';
import {
  createValkeyStoreFromClient,
  type MinimalRedisClient,
} from './rate-limit-valkey-store';

/**
 * A minimal in-memory fake standing in for a real Valkey server, faithful to
 * the Redis semantics the store relies on: INCR/PEXPIRE-only-on-first-hit via
 * `eval`, GET+PTTL for `peek`, DEL for `reset`. `now` is injectable so TTL
 * expiry is deterministic in tests.
 */
function fakeRedisClient(now: () => number = Date.now): MinimalRedisClient {
  const data = new Map<string, { value: number; expiresAt: number | null }>();

  function prune(key: string): void {
    const entry = data.get(key);
    if (entry !== undefined && entry.expiresAt !== null && entry.expiresAt <= now()) {
      data.delete(key);
    }
  }

  return {
    eval(_script: string, _numKeys: number, ...args: Array<string | number>) {
      const key = String(args[0]);
      const windowMs = Number(args[1]);
      prune(key);
      const existing = data.get(key);
      let entry: { value: number; expiresAt: number | null };
      if (existing === undefined) {
        entry = { value: 1, expiresAt: now() + windowMs };
        data.set(key, entry);
      } else {
        entry = existing;
        entry.value += 1;
      }
      const ttl = entry.expiresAt === null ? -1 : entry.expiresAt - now();
      return Promise.resolve([entry.value, ttl]);
    },

    get(key: string) {
      prune(key);
      const entry = data.get(key);
      return Promise.resolve(entry === undefined ? null : String(entry.value));
    },

    pttl(key: string) {
      prune(key);
      const entry = data.get(key);
      if (entry === undefined) return Promise.resolve(-2);
      if (entry.expiresAt === null) return Promise.resolve(-1);
      return Promise.resolve(entry.expiresAt - now());
    },

    del(key: string) {
      const existed = data.has(key);
      data.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    },
  };
}

describe('createValkeyStoreFromClient', () => {
  it('hit() increments via a single eval call and returns the new count', async () => {
    const client = fakeRedisClient(() => 1_000_000);
    const store = createValkeyStoreFromClient(client);

    expect((await store.hit('rl:test:a', 10_000)).count).toBe(1);
    expect((await store.hit('rl:test:a', 10_000)).count).toBe(2);
    expect((await store.hit('rl:test:a', 10_000)).count).toBe(3);
  });

  it('hit() calls eval exactly once per hit (one atomic round trip, no separate read-then-write)', async () => {
    const client = fakeRedisClient(() => 1_000_000);
    const evalSpy = vi.spyOn(client, 'eval');
    const getSpy = vi.spyOn(client, 'get');
    const store = createValkeyStoreFromClient(client);

    await store.hit('rl:test:b', 10_000);

    expect(evalSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('peek() reads the count without incrementing', async () => {
    const client = fakeRedisClient(() => 1_000_000);
    const store = createValkeyStoreFromClient(client);

    await store.hit('rl:test:c', 10_000);
    await store.peek('rl:test:c');
    await store.peek('rl:test:c');
    const result = await store.peek('rl:test:c');

    expect(result?.count).toBe(1);
  });

  it('peek() returns null for an absent key', async () => {
    const client = fakeRedisClient(() => 1_000_000);
    const store = createValkeyStoreFromClient(client);

    expect(await store.peek('rl:test:missing')).toBeNull();
  });

  it('reset() clears the key — a subsequent hit starts a fresh window', async () => {
    const client = fakeRedisClient(() => 1_000_000);
    const store = createValkeyStoreFromClient(client);

    await store.hit('rl:test:d', 10_000);
    await store.hit('rl:test:d', 10_000);
    await store.reset('rl:test:d');

    expect(await store.peek('rl:test:d')).toBeNull();
    expect((await store.hit('rl:test:d', 10_000)).count).toBe(1);
  });

  it('a window expiring (PTTL hits 0) lets the next hit start a fresh count at 1', async () => {
    let now = 1_000_000;
    const client = fakeRedisClient(() => now);
    const store = createValkeyStoreFromClient(client);

    expect((await store.hit('rl:test:e', 5_000)).count).toBe(1);
    now += 5_001;
    expect((await store.hit('rl:test:e', 5_000)).count).toBe(1);
  });

  it('propagates a client error so withMemoryFallback (rate-limit.ts) can catch it', async () => {
    const client: MinimalRedisClient = {
      eval: () => Promise.reject(new Error('ECONNREFUSED')),
      get: () => Promise.reject(new Error('ECONNREFUSED')),
      pttl: () => Promise.reject(new Error('ECONNREFUSED')),
      del: () => Promise.reject(new Error('ECONNREFUSED')),
    };
    const store = createValkeyStoreFromClient(client);

    await expect(store.hit('rl:test:f', 10_000)).rejects.toThrow('ECONNREFUSED');
    await expect(store.peek('rl:test:f')).rejects.toThrow('ECONNREFUSED');
    await expect(store.reset('rl:test:f')).rejects.toThrow('ECONNREFUSED');
  });
});
