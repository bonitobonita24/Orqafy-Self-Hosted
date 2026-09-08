// Public server entry for cross-package TYPE consumption (the `@orqafy/web/server`
// export). Type-only: this file emits nothing at runtime (verbatimModuleSyntax),
// so importing it from @orqafy/api-client pulls in NO server/db runtime code —
// it only threads the AppRouter type through to the mobile/desktop clients.
export type { AppRouter } from './root';
