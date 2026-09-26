// Mobile bearer identity resolution — shared by the tRPC context
// (server/context.ts) and Route Handlers via server/request-auth.ts.
//
// Identity ONLY (see lib/mobile-token): the token is read from the
// Authorization header only (never a cookie), verified (HS256, alg-pinned), and
// the user's `isActive` flag is re-checked from the DB on EVERY request, because
// a stateless token cannot otherwise be revoked. Permissions are never carried
// by the token; callers resolve them fresh (server/permissions).
// Kept free of next-auth imports so it is unit-testable in plain node.
import 'server-only';
import type { Session } from 'next-auth';
import { prisma } from '@orqafy/db';
import { verifyMobileToken } from '../lib/mobile-token';

const BEARER_RE = /^Bearer (.+)$/;

export interface BearerIdentity {
  userId: string;
  /** Synthesized so downstream `session !== null` checks match the cookie path. */
  session: Session;
}

/** Injection seam for unit tests; production uses the real verifier + Prisma. */
export interface BearerDeps {
  verify: (token: string) => Promise<string | null>;
  findUser: (
    id: string,
  ) => Promise<{ id: string; name: string; email: string; isActive: boolean } | null>;
}

const defaultDeps: BearerDeps = {
  verify: verifyMobileToken,
  findUser: (id) => prisma.user.findUnique({ where: { id } }),
};

/**
 * Resolve a mobile bearer identity from the Authorization header, or null when
 * absent/invalid/expired or the user is missing or deactivated. Never throws on
 * a bad token.
 */
export async function resolveBearerIdentity(
  req?: Request,
  deps: BearerDeps = defaultDeps,
): Promise<BearerIdentity | null> {
  const authz = req?.headers.get('authorization') ?? null;
  const token = authz !== null ? (BEARER_RE.exec(authz)?.[1] ?? null) : null;
  if (token === null) return null;

  const uid = await deps.verify(token);
  if (uid === null) return null;

  const user = await deps.findUser(uid);
  if (user === null || !user.isActive) return null;

  // The token's own exp is the real lifetime (enforced in verifyMobileToken);
  // this `expires` is a formality set 1 year ahead.
  const session = {
    user: { id: uid, name: user.name, email: user.email },
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  } as Session;
  return { userId: uid, session };
}
