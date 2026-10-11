// Rate limiting for the mobile bearer-login endpoint (brute force) and the
// site-photo upload endpoint (per-user volume).
//
// v2 posture: the attempt-consume operation is ATOMIC — `hit()` is a single
// store call that increments a fixed-window counter and returns the new count
// + the window's reset time in one round trip, so callers decide block/allow
// from the returned count with no separate read-then-write (no TOCTOU window
// for a concurrent racer to slip through between a read and a later write).
// `peek()` is a read-only, non-mutating lookup. No login/upload gate below
// calls it anymore (see checkLoginRateLimit's doc comment for why a `peek()`
// pre-check on the email key was itself a TOCTOU) — it is kept on the
// interface as a non-mutating introspection primitive for store-contract
// tests and potential future read-only callers (e.g. an admin/observability
// endpoint), never for a decide-to-block check.
//
// Two RateLimitStore implementations:
//  - `createMemoryStore()` — single-process, in-memory. Synchronous Map
//    mutation under the hood, so `hit()` is trivially atomic in-process, but
//    state resets on restart and is NOT shared across instances.
//  - `createValkeyStore()` (rate-limit-valkey-store.ts) — Valkey/Redis-backed
//    via a single Lua script (INCR + conditional PEXPIRE), atomic across
//    instances and restart-durable. Selected by `getRateLimitStore()` when
//    `VALKEY_URL` is set; wrapped to fail open to the in-memory store on any
//    Valkey error (see `withMemoryFallback` below) so login availability never
//    depends on Valkey being up.
import 'server-only';
import { createValkeyStore } from './rate-limit-valkey-store';

/**
 * A minimal fixed-window counter store.
 *
 * `hit` is the ONE atomic attempt-consume operation: increments the counter
 * for `key` and returns the new count plus `resetAt` (ms epoch when the
 * window ends). On the first hit of a window the TTL is established; later
 * hits within the same window return an incremented count against the SAME
 * `resetAt` (fixed window, not sliding). Single call, no intermediate read —
 * this is what makes concurrent callers race-free.
 *
 * `peek` reads the current count + `resetAt` WITHOUT mutating — `null` if the
 * key is absent or its window has expired. A decide-to-block check must
 * NEVER use `peek` (a read-then-later-write split reopens the exact TOCTOU
 * this store exists to close under concurrent callers) — it exists purely
 * for non-mutating introspection (tests, future read-only observability).
 *
 * `reset` clears a key (e.g. on successful login).
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  peek(key: string): Promise<{ count: number; resetAt: number } | null>;
  reset(key: string): Promise<void>;
}

interface Entry {
  count: number;
  expiresAt: number;
}

/**
 * In-memory fixed-window store backed by a Map. `now` is injectable for
 * deterministic tests (defaults to `Date.now`). All mutation happens
 * synchronously inside a single turn of the event loop (no `await` between
 * the read and the write), so concurrent in-process callers never race —
 * the Promise wrapping is only to satisfy the (genuinely async) interface
 * shared with the Valkey store.
 */
export function createMemoryStore(now: () => number = Date.now): RateLimitStore {
  const entries = new Map<string, Entry>();

  return {
    hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
      const t = now();
      const existing = entries.get(key);
      if (existing === undefined || existing.expiresAt <= t) {
        // Start a fresh window.
        const expiresAt = t + windowMs;
        entries.set(key, { count: 1, expiresAt });
        return Promise.resolve({ count: 1, resetAt: expiresAt });
      }
      existing.count += 1;
      return Promise.resolve({ count: existing.count, resetAt: existing.expiresAt });
    },

    peek(key: string): Promise<{ count: number; resetAt: number } | null> {
      const t = now();
      const existing = entries.get(key);
      if (existing === undefined) return Promise.resolve(null);
      if (existing.expiresAt <= t) {
        // Prune expired entry on read.
        entries.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve({ count: existing.count, resetAt: existing.expiresAt });
    },

    reset(key: string): Promise<void> {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}

/**
 * Wraps a primary store so that any error from `primary` (e.g. a Valkey
 * connection drop) falls back to `fallback` for that call instead of
 * rejecting. Chosen posture: FAIL-OPEN-TO-MEMORY-STORE, not fail-open-to-
 * allow-everything — a Valkey outage degrades to single-process in-memory
 * limiting (still enforced, just not cross-instance/durable) rather than
 * disabling rate limiting entirely. Login/upload availability must never
 * depend on Valkey being reachable. Logs once per process to avoid spamming
 * on every request during an outage.
 */
export function withMemoryFallback(
  primary: RateLimitStore,
  fallback: RateLimitStore,
): RateLimitStore {
  let warned = false;
  function warnOnce(err: unknown): void {
    if (warned) return;
    warned = true;
    console.warn(
      '[rate-limit] Valkey store failed; falling back to in-memory limiting for this process:',
      err,
    );
  }

  return {
    async hit(key, windowMs) {
      try {
        return await primary.hit(key, windowMs);
      } catch (err) {
        warnOnce(err);
        return fallback.hit(key, windowMs);
      }
    },
    async peek(key) {
      try {
        return await primary.peek(key);
      } catch (err) {
        warnOnce(err);
        return fallback.peek(key);
      }
    },
    async reset(key) {
      try {
        await primary.reset(key);
      } catch (err) {
        warnOnce(err);
        await fallback.reset(key);
      }
    },
  };
}

const globalForRateLimit = globalThis as unknown as { orqafyRateLimitStore?: RateLimitStore };

/**
 * Resolves the Valkey/Redis connection URL the rate limiter should use, with
 * the SAME `VALKEY_URL ?? REDIS_URL` precedence as
 * `packages/jobs/src/connection.ts` (`connectionFromEnv`) — an installer that
 * only sets `REDIS_URL` must get the Valkey-backed limiter too, not silently
 * fall back to in-memory. Returns `undefined` when neither is set (or set to
 * an empty string), which selects the in-memory store. Exported standalone
 * (pure function of `env`) so each env combination is unit-testable without
 * touching the globalThis-cached singleton below.
 */
export function resolveRateLimitBackendUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const valkeyUrl = env.VALKEY_URL;
  if (valkeyUrl !== undefined && valkeyUrl.length > 0) return valkeyUrl;
  const redisUrl = env.REDIS_URL;
  if (redisUrl !== undefined && redisUrl.length > 0) return redisUrl;
  return undefined;
}

/**
 * The process-wide rate-limit store, built lazily and cached on globalThis so
 * Next.js dev HMR never resets the counters mid-session (same pattern as the
 * queue registry).
 *
 * Selects a Valkey-backed store when `resolveRateLimitBackendUrl()` resolves
 * a URL (multi-instance / restart-durable limiting), else the in-memory
 * store (v1 posture, e.g. local dev with no Valkey configured). A Valkey
 * store is always wrapped with `withMemoryFallback` — see that function's
 * doc comment for the fail-open posture and rationale.
 */
export function getRateLimitStore(): RateLimitStore {
  const existing = globalForRateLimit.orqafyRateLimitStore;
  if (existing !== undefined) return existing;

  const memory = createMemoryStore();
  const valkeyUrl = resolveRateLimitBackendUrl();
  let store: RateLimitStore;
  if (valkeyUrl !== undefined && valkeyUrl.length > 0) {
    try {
      store = withMemoryFallback(createValkeyStore(valkeyUrl), memory);
    } catch (err) {
      console.warn(
        '[rate-limit] failed to construct the Valkey store; using in-memory limiting:',
        err,
      );
      store = memory;
    }
  } else {
    store = memory;
  }

  globalForRateLimit.orqafyRateLimitStore = store;
  return store;
}

// Config with env overrides + sane defaults (Number-parsed, NaN → default).
const IP_MAX = Number(process.env.MOBILE_LOGIN_IP_MAX) || 20;
const EMAIL_MAX = Number(process.env.MOBILE_LOGIN_EMAIL_MAX) || 5;
const WINDOW_SEC = Number(process.env.MOBILE_LOGIN_WINDOW_SEC) || 900;

/**
 * Number of reverse-proxy hops between the client and this app (Traefik /
 * Pangolin = 1 by default). `x-forwarded-for` is appended LEFT→RIGHT: each
 * proxy appends the peer that connected to IT, so the entry added by OUR
 * trusted proxy is the Nth-from-the-right entry (N = hops), never the
 * leftmost one. Coerced to >= 1 — NaN or < 1 both fall back to 1.
 *
 * Read lazily (not a module-level const like IP_MAX/EMAIL_MAX/WINDOW_SEC)
 * because clientIp() is a pure header-parsing helper exercised directly in
 * tests with per-test env overrides — a module-load-time snapshot would be
 * frozen to whatever TRUSTED_PROXY_HOPS was set to at import time.
 */
function trustedProxyHops(): number {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

/**
 * Best-effort client IP from proxy headers.
 *
 * SECURITY: `x-forwarded-for` is a client-controlled header — an attacker can
 * prepend arbitrary (even rotating) entries to the LEFT of it. Trusting the
 * leftmost entry lets an attacker present a different "IP" on every request
 * (`X-Forwarded-For: <random>, ...`), defeating the per-IP brute-force limiter
 * entirely. Only the entries APPENDED BY OUR OWN trusted reverse proxy chain
 * can be trusted, and because XFF is appended left→right, those are always
 * the RIGHTMOST `TRUSTED_PROXY_HOPS` entries. This resolves the client as the
 * entry `TRUSTED_PROXY_HOPS` positions from the right (default hops=1 → the
 * single rightmost entry), so any client-prepended spoof entries are ignored
 * and cannot change the resolved IP or evade the per-IP limit.
 *
 * Falls back to `x-real-ip` when XFF is absent/empty, else `'unknown'`.
 *
 * NOTE: this still TRUSTS the front proxy (Traefik / Pangolin) to set XFF
 * correctly for the configured number of hops — the deployment must ensure
 * the app is only reachable through that proxy chain, and TRUSTED_PROXY_HOPS
 * must match the actual number of trusted proxies in front of the app.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff !== null && xff.length > 0) {
    const entries = xff
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (entries.length > 0) {
      const hops = trustedProxyHops();
      // Rightmost entry = index (length - 1); Nth-from-right = (length - hops).
      // If fewer entries than hops (misconfig), fall back to the leftmost
      // available entry rather than indexing out of bounds.
      const idx = entries.length >= hops ? entries.length - hops : 0;
      const resolved = entries[idx];
      if (resolved !== undefined) return resolved;
    }
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp !== null && realIp.trim().length > 0) return realIp.trim();
  return 'unknown';
}

function ipKey(ip: string): string {
  return `rl:mlogin:ip:${ip}`;
}

function emailKey(email: string): string {
  // Lowercase/trim to match the route's canonicalization.
  return `rl:mlogin:email:${email.trim().toLowerCase()}`;
}

/**
 * Decide whether a login attempt may proceed. Called BEFORE the DB lookup.
 *
 * - Always increments the per-IP counter; over IP_MAX → blocked.
 * - Always increments the per-email counter too — ATOMICALLY, via the same
 *   `hit()` the IP check uses. This counts every ATTEMPT for that email (not
 *   just failures); over EMAIL_MAX → blocked. A correct password clears this
 *   counter via `recordLoginSuccess`, so a legit user is never penalized for
 *   accumulated past attempts.
 *   SECURITY (closes a TOCTOU, audit follow-up): the previous version only
 *   `peek()`ed the email counter here and relied on a SEPARATE later call
 *   (`recordLoginFailure`) to increment it. N concurrent requests for the
 *   SAME email could all `peek()` the same under-limit count before any of
 *   them incremented it, letting all N through regardless of EMAIL_MAX. A
 *   single atomic `hit()` up front — exactly like the IP counter — closes
 *   that window: the count every racing request observes already reflects
 *   every other racing request's hit.
 * - FAIL-OPEN: any store error returns `allowed: true` (never block a legit
 *   login because the limiter is unhealthy).
 */
export async function checkLoginRateLimit(
  store: RateLimitStore,
  args: { ip: string; email: string | null },
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    // Atomic increment+check — no separate read-then-write, so concurrent
    // requests from the same IP can never both observe a count under the
    // limit and both proceed.
    const ipHit = await store.hit(ipKey(args.ip), WINDOW_SEC * 1000);
    if (ipHit.count > IP_MAX) {
      return { allowed: false, retryAfterSec: WINDOW_SEC };
    }

    if (args.email !== null) {
      const emailHit = await store.hit(emailKey(args.email), WINDOW_SEC * 1000);
      if (emailHit.count > EMAIL_MAX) {
        return { allowed: false, retryAfterSec: WINDOW_SEC };
      }
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn('[rate-limit] checkLoginRateLimit failed open:', err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

// ── Site-photo upload limiter (F3) ─────────────────────────────────────────
// Per authenticated user: bounds how many (up to ~16 MiB) bodies one account
// can push through POST /api/photos per window. Same store, distinct key space.
const PHOTO_UPLOAD_MAX = Number(process.env.PHOTO_UPLOAD_MAX) || 60;
const PHOTO_UPLOAD_WINDOW_SEC = Number(process.env.PHOTO_UPLOAD_WINDOW_SEC) || 600;

/**
 * Count one photo-upload attempt for `userId` and decide whether it may
 * proceed. Called after auth, BEFORE the body is buffered. FAIL-OPEN like the
 * login limiter: a store error never blocks a legitimate upload.
 */
export async function checkPhotoUploadRateLimit(
  store: RateLimitStore,
  userId: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    const hit = await store.hit(`rl:photo:user:${userId}`, PHOTO_UPLOAD_WINDOW_SEC * 1000);
    if (hit.count > PHOTO_UPLOAD_MAX) {
      return { allowed: false, retryAfterSec: PHOTO_UPLOAD_WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn('[rate-limit] checkPhotoUploadRateLimit failed open:', err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/**
 * Record a successful login for an email — clears its per-email attempt
 * counter (incremented by `checkLoginRateLimit`'s `hit()` on every attempt,
 * success or failure) so a legit user isn't later blocked by attempts that
 * already succeeded.
 */
export async function recordLoginSuccess(store: RateLimitStore, email: string): Promise<void> {
  try {
    await store.reset(emailKey(email));
  } catch (err) {
    console.warn('[rate-limit] recordLoginSuccess failed:', err);
  }
}

// ── Self-service password-change limiter (ORQ-55 W2b) ─────────────────────
// `changePassword` (server/routers/auth.ts) verifies `currentPassword` with
// bcrypt — the same online-guessing surface the login path already hardens,
// just against an AUTHENTICATED caller (a stolen/hijacked session guessing
// the real password to pivot past 2FA-less reauth, or to outlast a future
// forced-rotation). Reuses the exact SAME store + SAME atomic-hit/reset
// shape as `checkLoginRateLimit`/`recordLoginSuccess` (no separate limiter
// infra): key per-user (the caller is already authenticated, so there is no
// anonymous IP to also gate — see rate-limit.test.ts for why this is
// sufficient here), `hit()` BEFORE the password check so every attempt
// (success or fail) counts and a concurrent-attempt race can't let more than
// one extra request slip past the threshold, and the counter resets on a
// successful change so a legit user is never penalized for attempts that
// already succeeded. Threshold mirrors login's per-EMAIL posture (5 attempts
// / 15 min) since both gate a bcrypt compare against one identity.
const CHANGE_PASSWORD_MAX = Number(process.env.CHANGE_PASSWORD_MAX) || 5;
const CHANGE_PASSWORD_WINDOW_SEC = Number(process.env.CHANGE_PASSWORD_WINDOW_SEC) || 900;

function changePasswordKey(userId: string): string {
  return `rl:changepw:user:${userId}`;
}

/**
 * Decide whether a `changePassword` attempt may proceed. Called BEFORE the
 * current-password bcrypt check (gate-first, same posture as
 * `checkLoginRateLimit`). FAIL-OPEN: any store error returns `allowed: true`
 * (never block a legitimate password change because the limiter is
 * unhealthy).
 */
export async function checkChangePasswordRateLimit(
  store: RateLimitStore,
  userId: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    const hit = await store.hit(changePasswordKey(userId), CHANGE_PASSWORD_WINDOW_SEC * 1000);
    if (hit.count > CHANGE_PASSWORD_MAX) {
      return { allowed: false, retryAfterSec: CHANGE_PASSWORD_WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn('[rate-limit] checkChangePasswordRateLimit failed open:', err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/**
 * Record a successful password change for `userId` — clears the counter
 * `checkChangePasswordRateLimit` incremented on every attempt, mirroring
 * `recordLoginSuccess`.
 */
export async function recordChangePasswordSuccess(
  store: RateLimitStore,
  userId: string,
): Promise<void> {
  try {
    await store.reset(changePasswordKey(userId));
  } catch (err) {
    console.warn('[rate-limit] recordChangePasswordSuccess failed:', err);
  }
}
