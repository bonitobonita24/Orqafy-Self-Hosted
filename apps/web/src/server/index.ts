// Public server entry for cross-package TYPE consumption (the `@orqafy/web/server`
// export). Type-only: this file emits nothing at runtime (verbatimModuleSyntax),
// so importing it from @orqafy/api-client pulls in NO server/db runtime code —
// it only threads the AppRouter type through to the mobile/desktop clients.
//
// The `import type {}` below is erased at compile time (verbatimModuleSyntax
// never emits a type-only import) — it loads the `next-auth`/`next-auth/jwt`
// module augmentation (session.user.id, session.authTime — L-2 web
// revocation) into ANY tsc program that type-checks this entry file. Without
// it, a consumer with its OWN tsconfig (e.g. @orqafy/api-client, whose
// `include` never reaches apps/web/src/types/next-auth.d.ts) resolves the
// root router's transitive imports (./root → context.ts → ../auth.ts)
// against the UN-augmented `next-auth` types and fails with "Property
// 'authTime' does not exist on type 'Session'" — even though
// `pnpm -C apps/web typecheck` alone is green, because that invocation's own
// `include` already covers the .d.ts directly. (A triple-slash reference
// would also work but is banned by @typescript-eslint/triple-slash-reference.)
import type {} from '../types/next-auth';
export type { AppRouter } from './root';
