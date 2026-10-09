// Shared brute-force-guarded credential check for the WEB Auth.js Credentials
// provider — mirrors apps/web/src/app/api/mobile/login/route.ts exactly (same
// store, same key strategy by IP + email, same order of checks: rate-limit
// BEFORE any DB work, generic rejection on every failure path) so the cookie
// login and the bearer login cannot diverge (audit H-3: web login previously
// had NO rate limit at all).
//
// Deps-injected (no `@orqafy/db` / `next-auth` import here) so this is unit
// tested without a DB — same pattern as server/photo-upload.ts.
import { z } from 'zod';
import {
  checkLoginRateLimit,
  clientIp,
  recordLoginFailure,
  recordLoginSuccess,
  type RateLimitStore,
} from './rate-limit';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface CredentialsAuthDeps {
  store: RateLimitStore;
  findUserByEmail: (email: string) => Promise<{
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
    passwordHash: string;
  } | null>;
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
}

export interface AuthorizedUser {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Returns the authorized user, or `null` on ANY rejection (invalid input
 * shape, rate-limited, unknown/inactive user, wrong password) — Auth.js maps
 * a `null` `authorize()` return to one generic sign-in failure, so this never
 * distinguishes "locked out" from "bad password" to the client.
 */
export async function authorizeCredentials(
  deps: CredentialsAuthDeps,
  raw: unknown,
  request: Request,
): Promise<AuthorizedUser | null> {
  const parsed = credentialsSchema.safeParse(raw);
  const ip = clientIp(request);
  const email = parsed.success ? parsed.data.email.trim().toLowerCase() : null;

  // Brute-force gate BEFORE any DB work (per-IP always, per-email on failures)
  // — identical call shape to the mobile route.
  const rl = await checkLoginRateLimit(deps.store, { ip, email });
  if (!rl.allowed) return null;

  if (!parsed.success || email === null) return null;

  const user = await deps.findUserByEmail(email);
  if (user === null || !user.isActive) {
    await recordLoginFailure(deps.store, email);
    return null;
  }

  const ok = await deps.verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await recordLoginFailure(deps.store, email);
    return null;
  }

  // Success — clear the email failure counter.
  await recordLoginSuccess(deps.store, email);
  return { id: user.id, name: user.name, email: user.email };
}
