// Request authentication for plain Route Handlers (e.g. POST /api/photos) that
// must accept BOTH the Auth.js cookie session and the mobile bearer token.
// The bearer path is the exact one the tRPC context uses (server/bearer-identity).
import 'server-only';
import { auth } from '../auth';
import { defaultActiveUserDeps, type ActiveUserDeps } from './active-user';
import { resolveBearerIdentity } from './bearer-identity';

/**
 * The authenticated user id for a Route Handler request: a valid mobile bearer
 * first, else the Auth.js cookie session. Null when neither authenticates.
 *
 * The cookie-session path is re-checked for `isActive` fresh from the DB
 * (H-2) — a deactivated user's existing cookie session must stop
 * authenticating immediately, same as the bearer path already does.
 */
export async function resolveRequestUserId(
  req: Request,
  activeUserDeps: ActiveUserDeps = defaultActiveUserDeps,
): Promise<string | null> {
  const bearer = await resolveBearerIdentity(req);
  if (bearer !== null) return bearer.userId;

  const session = await auth();
  const id = session?.user?.id;
  if (typeof id !== 'string' || id.length === 0) return null;

  return (await activeUserDeps.isUserActive(id)) ? id : null;
}
