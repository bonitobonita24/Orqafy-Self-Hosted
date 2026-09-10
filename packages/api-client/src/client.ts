// Typed tRPC client factory for Orqafy. Transport wiring only — the router
// type comes from the server at Part 5 (see ./app-router).
//
// The server encodes responses with superjson (see apps/web trpc init), so the
// client MUST use the same transformer or Dates/Sets decode wrong. Subscriptions
// (the notification stream) ride httpSubscriptionLink; everything else batches
// over HTTP — mirroring apps/web/src/components/providers.tsx.
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
  type CreateTRPCClient,
} from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from './app-router';

export interface OrqafyClientOptions {
  /** Base URL of the Orqafy tRPC endpoint (e.g. http://localhost:56483/api/trpc). */
  url: string;
  /** Extra headers applied to every batched request (e.g. an Authorization bearer). */
  headers?: Record<string, string>;
}

/** The fully-typed Orqafy tRPC client (procedures inferred from AppRouter). */
export type OrqafyApiClient = CreateTRPCClient<AppRouter>;

/** Build a typed Orqafy tRPC client for the given endpoint. */
export function createOrqafyClient(options: OrqafyClientOptions): OrqafyApiClient {
  const { url, headers } = options;
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: httpSubscriptionLink({ url, transformer: superjson }),
        false:
          headers !== undefined
            ? httpBatchLink({ url, transformer: superjson, headers: () => headers })
            : httpBatchLink({ url, transformer: superjson }),
      }),
    ],
  });
}
