// tRPC HTTP endpoint (App Router fetch adapter). The context reads the Auth.js
// session from cookies, so no auth headers are threaded here.
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
    createContext: () => createTRPCContext(),
  });

export { handler as GET, handler as POST };
