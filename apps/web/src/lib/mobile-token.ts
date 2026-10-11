// Mobile bearer-token issuance + verification (HS256, algorithm-PINNED).
// Companion to the Auth.js v5 cookie/session path — this is the STATELESS token
// the Expo app carries: the server issues it at /api/mobile/login and the tRPC
// context accepts it via the Authorization header (see server/context.ts).
//
// Security posture:
//   • The token asserts IDENTITY ONLY — subject = userId. It never carries roles
//     or permissions; those are always resolved fresh from the DB per request.
//   • alg is pinned to HS256 on both sign and verify (verify allowlists exactly
//     one algorithm), so alg:none and RS256↔HS256 confusion are rejected
//     (security.md — JWT algorithm pinning).
//   • The signing key is AUTH_SECRET (same ≥32-byte secret Auth.js uses); reading
//     it fails CLOSED if it is missing.
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const MOBILE_TYP = 'mobile';
const TTL = '60d';

/** The HMAC signing key derived from AUTH_SECRET. Throws (fail-closed) if unset. */
function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret === undefined || secret.length === 0) {
    throw new Error('AUTH_SECRET is not set — cannot sign or verify mobile tokens.');
  }
  return new TextEncoder().encode(secret);
}

/** Issue a 60-day mobile bearer token whose subject is the given user id. */
export async function signMobileToken(userId: string): Promise<string> {
  const token = await new SignJWT({ typ: MOBILE_TYP })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getAuthSecret());
  return token;
}

/** The verified identity + issuance time of a mobile bearer token. */
export interface VerifiedMobileToken {
  userId: string;
  /** `iat` claim, in seconds since epoch — when this token was issued. */
  issuedAt: number;
}

/**
 * Verify a mobile bearer token. Returns the user id (subject) + issuedAt (the
 * `iat` claim, seconds) on success, or null on ANY failure: bad signature,
 * wrong/absent/`none` algorithm, expiry, a `typ` that is not "mobile", a
 * missing subject, a missing/non-numeric `iat`, or a malformed token.
 * NEVER throws — a caller treats null as "not authenticated by bearer".
 */
export async function verifyMobileToken(token: string): Promise<VerifiedMobileToken | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: [ALG] });
    if (payload.typ !== MOBILE_TYP) return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    if (typeof payload.iat !== 'number') return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null;
  }
}
