// ---------------------------------------------------------------------------
// PLACEHOLDER AppRouter type — the Part 2 / Part 5 seam.
//
// The real tRPC router is defined by the server in Part 5 (apps/web, D-1:
// Next.js + tRPC). It does not exist yet, so this package is wired against the
// generic `AnyTRPCRouter` so it typechecks and compiles today.
//
// AT PART 5, replace the two lines below with a TYPE-ONLY import of the real
// router, e.g.:
//
//     import type { AppRouter } from '@orqafy/web/server';
//     export type { AppRouter };
//
// Nothing else in this package changes — `createOrqafyClient` already threads
// `AppRouter` through `createTRPCClient<AppRouter>`, so swapping this type in
// gives every call full end-to-end type safety.
//
// ⚠ LAYERING: this is a `import type` (erased at build). This package must
// import NEITHER `@orqafy/db` NOR any jobs package — types only.
// ---------------------------------------------------------------------------
import type { AnyTRPCRouter } from '@trpc/server';

export type AppRouter = AnyTRPCRouter;
