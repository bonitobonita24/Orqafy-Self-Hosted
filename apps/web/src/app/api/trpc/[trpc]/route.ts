// tRPC HTTP endpoint (App Router fetch adapter). The request is threaded into
// the context so it can read a mobile `Authorization: Bearer` token; the context
// falls back to the Auth.js cookie session when no valid bearer is present.
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/root';
import { createTRPCContext } from '@/server/context';

// SSE subscriptions (httpSubscriptionLink) ride GET; keep the stream unbuffered.
export const dynamic = 'force-dynamic';

const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext(req),
  });

export { handler as GET, handler as POST };
