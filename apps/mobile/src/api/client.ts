// Authenticated tRPC client construction for the mobile app (chunk 3b).
//
// `createOrqafyClient` (chunk 3a) captures its `headers` map AT CREATION and
// applies it to every batched request. It does NOT observe later mutations, so
// the auth header cannot be swapped in place — callers REBUILD the client after
// any token change (login / logout / mount-hydrate). AuthContext owns that
// rebuild lifecycle; these are the low-level builders.
import { createOrqafyClient, type OrqafyApiClient } from '@orqafy/api-client';

import { TRPC_URL } from '@/config';
import { getToken } from '@/auth/token-store';

/**
 * Build a client bound to `token`. Pass `null` for an unauthenticated client
 * (no Authorization header) — used for the signed-out state and the login call
 * itself (which goes through the REST endpoint, not tRPC).
 */
export function createAuthedClient(token: string | null): OrqafyApiClient {
  return createOrqafyClient({
    url: TRPC_URL,
    headers: token !== null ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Build a client from the currently-persisted token (convenience). */
export async function getAuthedClient(): Promise<OrqafyApiClient> {
  const token = await getToken();
  return createAuthedClient(token);
}
