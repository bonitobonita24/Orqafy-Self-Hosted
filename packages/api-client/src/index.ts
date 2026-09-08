// @orqafy/api-client — typed tRPC client wiring for the Orqafy apps.
// Layering: depends only on @orqafy/shared (types) + @trpc/client. It imports
// NEITHER @orqafy/db NOR any jobs package (framework layering rule).
export { createOrqafyClient } from './client';
export type { OrqafyApiClient, OrqafyClientOptions } from './client';
export type { AppRouter } from './app-router';

// Re-export the shared domain types so apps import contract types from one place.
export type * from '@orqafy/shared';
