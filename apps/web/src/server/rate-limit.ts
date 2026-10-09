// Rate limiting for the mobile bearer-login endpoint (brute force) and the
// site-photo upload endpoint (per-user volume).
//
// v1 posture: a single-process, in-memory fixed-window limiter behind a small
// dependency-injected interface — the same precedent as the in-memory SSE
// realtime bus. State lives only in this process, so it resets on restart and
// is NOT shared across instances. That is an accepted v1 tradeoff.
//
// SEAM: a Valkey-backed adapter (INCR + EXPIRE on a `rl:*` key) drops in here as
// an alternate `RateLimitStore` implementation for multi-instance / restart-
// durable limiting (POST-V1). No route code changes — only getRateLimitStore()
// swaps which store it builds. Do NOT add ioredis for v1.
import 'server-only';

/**
 * A minimal fixed-window counter store. `incr` bumps and returns the current
 * count within the window, establishing/keeping a TTL of `windowSec` on first
 * hit. `get` reads the current count without mutating. `reset` clears a key.
 */
export interface RateLimitStore {
  incr(key: string, windowSec: number): Promise<number>;
  get(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

interface Entry {
  count: number;
  expiresAt: number;
}

/**
 * In-memory fixed-window store backed by a Map. `now` is injectable for
 * deterministic tests (defaults to `Date.now`).
 */
export function createMemoryStore(now: () => number = Date.now): RateLimitStore {
  const entries = new Map<string, Entry>();

  // Methods are synchronous but return Promises to satisfy RateLimitStore — the
  // async Valkey adapter is genuinely async, so the interface is Promise-based.
  return {
    incr(key: string, windowSec: number): Promise<number> {
      const t = now();
      const existing = entries.get(key);
      if (existing === undefined || existing.expiresAt <= t) {
        // Start a fresh window.
        entries.set(key, { count: 1, expiresAt: t + windowSec * 1000 });
        return Promise.resolve(1);
      }
      existing.count += 1;
      return Promise.resolve(existing.count);
    },

    get(key: string): Promise<number> {
      const t = now();
      const existing = entries.get(key);
      if (existing === undefined) return Promise.resolve(0);
      if (existing.expiresAt <= t) {
        // Prune expired entry on read.
        entries.delete(key);
        return Promise.resolve(0);
      }
      return Promise.resolve(existing.count);
    },

    reset(key: string): Promise<void> {
      entries.delete(key);
      return Promise.resolve();
    },
  };
}

const globalForRateLimit = globalThis as unknown as { orqafyRateLimitStore?: RateLimitStore };

/**
 * The process-wide rate-limit store, built lazily and cached on globalThis so
 * Next.js dev HMR never resets the counters mid-session (same pattern as the
 * queue registry).
 *
 * SEAM: replace `createMemoryStore()` here with a Valkey-backed store to make
 * limiting durable across restarts and shared across instances (POST-V1).
 */
export function getRateLimitStore(): RateLimitStore {
  const existing = globalForRateLimit.orqafyRateLimitStore;
  if (existing !== undefined) return existing;

  const store = createMemoryStore();
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
 * - Reads (does NOT increment) the per-email failure counter; at/over EMAIL_MAX
 *   → blocked. The email counter is bumped only on an actual failed attempt via
 *   `recordLoginFailure`, so a correct password is never penalized.
 * - FAIL-OPEN: any store error returns `allowed: true` (never block a legit
 *   login because the limiter is unhealthy).
 */
export async function checkLoginRateLimit(
  store: RateLimitStore,
  args: { ip: string; email: string | null },
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    const ipCount = await store.incr(ipKey(args.ip), WINDOW_SEC);
    if (ipCount > IP_MAX) {
      return { allowed: false, retryAfterSec: WINDOW_SEC };
    }

    if (args.email !== null) {
      const emailFails = await store.get(emailKey(args.email));
      if (emailFails >= EMAIL_MAX) {
        return { allowed: false, retryAfterSec: WINDOW_SEC };
      }
    }

    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn('[rate-limit] checkLoginRateLimit failed open:', err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Record a failed login for an email (increments its failure counter). */
export async function recordLoginFailure(store: RateLimitStore, email: string): Promise<void> {
  try {
    await store.incr(emailKey(email), WINDOW_SEC);
  } catch (err) {
    console.warn('[rate-limit] recordLoginFailure failed:', err);
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
    const count = await store.incr(`rl:photo:user:${userId}`, PHOTO_UPLOAD_WINDOW_SEC);
    if (count > PHOTO_UPLOAD_MAX) {
      return { allowed: false, retryAfterSec: PHOTO_UPLOAD_WINDOW_SEC };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    console.warn('[rate-limit] checkPhotoUploadRateLimit failed open:', err);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Record a successful login for an email (clears its failure counter). */
export async function recordLoginSuccess(store: RateLimitStore, email: string): Promise<void> {
  try {
    await store.reset(emailKey(email));
  } catch (err) {
    console.warn('[rate-limit] recordLoginSuccess failed:', err);
  }
}
