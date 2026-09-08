// ---------------------------------------------------------------------------
// AppRouter type — the real Orqafy tRPC router, defined by the server in
// apps/web (Part 5). This is a TYPE-ONLY re-export (erased at build under
// verbatimModuleSyntax), so this package pulls in NO server/db runtime code —
// it stays a pure client that depends only on @orqafy/shared + @trpc/client.
//
// The mobile (Expo) and desktop (Tauri) apps import `createOrqafyClient` from
// this package and get full end-to-end type safety from the same AppRouter the
// web app serves. (apps/web itself uses its own colocated tRPC client, so there
// is no web ⇄ api-client dependency cycle.)
//
// ⚠ LAYERING: `@orqafy/web` is a devDependency here purely for this type import.
// This package must never import @orqafy/db or any jobs package at runtime.
// ---------------------------------------------------------------------------
export type { AppRouter } from '@orqafy/web/server';
