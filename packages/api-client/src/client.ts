// Typed tRPC client factory for Orqafy. Transport wiring only — the router
// type comes from the server at Part 5 (see ./app-router).
import { createTRPCClient, httpBatchLink, type CreateTRPCClient } from '@trpc/client';
import type { AppRouter } from './app-router';

export interface OrqafyClientOptions {
  /** Base URL of the Orqafy tRPC endpoint (e.g. http://localhost:56483/api/trpc). */
  url: string;
  /** Extra headers applied to every request (e.g. an Authorization bearer). */
  headers?: Record<string, string>;
}

/** The fully-typed Orqafy tRPC client (procedures inferred from AppRouter). */
export type OrqafyApiClient = CreateTRPCClient<AppRouter>;

/** Build a typed Orqafy tRPC client for the given endpoint. */
export function createOrqafyClient(options: OrqafyClientOptions): OrqafyApiClient {
  const { url, headers } = options;
  const link =
    headers !== undefined ? httpBatchLink({ url, headers: () => headers }) : httpBatchLink({ url });

  return createTRPCClient<AppRouter>({ links: [link] });
}
