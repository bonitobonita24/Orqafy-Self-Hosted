// tRPC request context. Carries the Prisma client, the Auth.js session, and the
// caller's resolved permission set (D-17) so every procedure can authorize
// against fresh grants.
//
// Two authentication paths, checked in order:
//   1. A mobile bearer token in the Authorization header (stateless, HS256,
//      alg-pinned — see lib/mobile-token, resolved by server/bearer-identity). Identity ONLY; the user's `isActive`
//      flag is re-checked from the DB on EVERY request, because a stateless
//      token cannot otherwise be revoked.
//   2. Fallback: the Auth.js v5 cookie session (unchanged).
// In BOTH paths, permissions are resolved fresh from the DB — a bearer identity
// NEVER carries permissions from the token.
import 'server-only';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { prisma } from '@orqafy/db';
import { auth } from '../auth';
import { resolveBearerIdentity } from './bearer-identity';
import { resolveUserPermissions } from './permissions';

export interface TRPCContext {
  prisma: typeof prisma;
  session: Session | null;
  userId: string | null;
  permissions: Set<Permission>;
}

/** Build the per-request context (bearer token first, then cookie session). */
export async function createTRPCContext(req?: Request): Promise<TRPCContext> {
  let session: Session | null = null;
  let userId: string | null = null;

  // 1. Mobile bearer token — read ONLY from the Authorization header (never a
  //    cookie). Identity is trusted only after verify + a fresh isActive check
  //    (server/bearer-identity, shared with Route Handlers such as /api/photos).
  const bearer = await resolveBearerIdentity(req);
  if (bearer !== null) {
    userId = bearer.userId;
    session = bearer.session;
  }

  // 2. Cookie session fallback (unchanged) — only when no valid bearer identity.
  if (userId === null) {
    session = await auth();
    userId = session?.user?.id ?? null;
  }

  // Permissions are ALWAYS resolved from the DB — never read from a token.
  const permissions =
    userId !== null ? await resolveUserPermissions(userId) : new Set<Permission>();

  return { prisma, session, userId, permissions };
}
