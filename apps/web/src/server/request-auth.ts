// Request authentication for plain Route Handlers (e.g. POST /api/photos) that
// must accept BOTH the Auth.js cookie session and the mobile bearer token.
// The bearer path is the exact one the tRPC context uses (server/bearer-identity).
import 'server-only';
import { auth } from '../auth';
import { resolveBearerIdentity } from './bearer-identity';

/**
 * The authenticated user id for a Route Handler request: a valid mobile bearer
 * first, else the Auth.js cookie session. Null when neither authenticates.
 */
export async function resolveRequestUserId(req: Request): Promise<string | null> {
  const bearer = await resolveBearerIdentity(req);
  if (bearer !== null) return bearer.userId;
  const session = await auth();
  const id = session?.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
