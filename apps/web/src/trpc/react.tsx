'use client';

// Typed tRPC React-Query hooks for the web app. This is the web app's OWN
// colocated client (it imports the AppRouter type directly), which is why the
// app does NOT depend on @orqafy/api-client — avoiding a web ⇄ api-client cycle.
// @orqafy/api-client stays the shared client for the mobile/desktop apps and
// type-imports the same AppRouter from @orqafy/web/server.
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/root';

// Explicit return-type annotation keeps the type portable under pnpm (TS2742).
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>();
