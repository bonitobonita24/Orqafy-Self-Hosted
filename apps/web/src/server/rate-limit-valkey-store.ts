// Valkey/Redis-backed `RateLimitStore` (apps/web/src/server/rate-limit.ts).
// Connection precedent: packages/jobs/src/connection.ts (same VALKEY_URL env
// var, same redis://-compatible Valkey instance used for BullMQ).
//
// `hit()` must be ATOMIC: increment the counter AND (on the very first
// increment of a window) set its expiry, in one server-side round trip — a
// JS-side "GET then SET/EXPIRE" would reopen the exact TOCTOU window this
// store exists to close under concurrent requests from multiple app
// instances. A single Lua script (EVAL) is the portable way to get that
// atomicity on both Redis and Valkey (Valkey is a Redis-protocol fork; this
// avoids depending on newer Redis-only commands like INCREX that Valkey may
// not implement).
import 'server-only';
import { Redis } from 'ioredis';
import type { RateLimitStore } from './rate-limit';

// INCR the key; PEXPIRE only when this increment started the window (count
// === 1) so a later hit within the same window never pushes the expiry back
// (fixed window, not sliding). PTTL reports the remaining ms so the caller
// can compute an accurate resetAt without a second round trip.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

/**
 * The slice of the ioredis client this store needs — kept narrow so unit
 * tests can supply a hand-written fake instead of a real connection or a
 * heavier client mock.
 */
export interface MinimalRedisClient {
  // `eval` here is ioredis's client method that sends a Lua script to the
  // Valkey/Redis SERVER for it to run (server-side EVAL, not JS `eval()`).
  // `HIT_SCRIPT` above is a fixed, hardcoded string — no user/request input
  // is ever interpolated into it; only KEYS/ARGV (the rate-limit key and
  // window) are passed as separate arguments. Not a code-injection surface.
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  get(key: string): Promise<string | null>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

/** Build a `RateLimitStore` over an already-constructed client (DI for tests). */
export function createValkeyStoreFromClient(client: MinimalRedisClient): RateLimitStore {
  return {
    async hit(key, windowMs) {
      const result = (await client.eval(HIT_SCRIPT, 1, key, windowMs)) as [number, number];
      const [count, ttlMs] = result;
      // PTTL returns -1 if the key somehow has no expiry (shouldn't happen —
      // PEXPIRE is always set on count===1) and -2 if the key vanished
      // between INCR and PTTL (extremely unlikely; treat as a fresh window).
      const resetAt = Date.now() + (ttlMs > 0 ? ttlMs : windowMs);
      return { count, resetAt };
    },

    async peek(key) {
      const [value, ttlMs] = await Promise.all([client.get(key), client.pttl(key)]);
      if (value === null) return null;
      const count = Number(value);
      if (!Number.isFinite(count)) return null;
      const resetAt = Date.now() + (ttlMs > 0 ? ttlMs : 0);
      return { count, resetAt };
    },

    async reset(key) {
      await client.del(key);
    },
  };
}

/**
 * Build a `RateLimitStore` backed by a fresh ioredis connection to `url`.
 * `lazyConnect: true` so constructing the store never blocks/throws before
 * the first command — connection errors surface from the first `hit`/`peek`/
 * `reset` call instead, where `withMemoryFallback` (rate-limit.ts) catches
 * them and degrades to the in-memory store.
 */
export function createValkeyStore(url: string): RateLimitStore {
  const client = new Redis(url, {
    lazyConnect: true,
    // Fail fast rather than buffering requests indefinitely while Valkey is
    // unreachable — a stuck retry queue would delay login responses instead
    // of promptly falling back to the in-memory store.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  // ioredis requires an 'error' listener once any command has been issued, or
  // an unhandled connection error crashes the process — this logs instead.
  client.on('error', (err: unknown) => {
    console.warn('[rate-limit] Valkey client connection error:', err);
  });
  return createValkeyStoreFromClient(client);
}
