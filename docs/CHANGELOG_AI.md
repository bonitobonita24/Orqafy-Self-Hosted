# CHANGELOG (AI) — Orqafy-Self-Hosted

Agent-attributed change log (Rule 3/15). Newest on top.

## 2026-09-09 — Self-hosted brand fonts [CLAUDE_CODE]
- **[FEATURE]** Self-host IBM Plex Sans + JetBrains Mono via `next/font/local` (vendored latin-subset OFL
  woff2, weights 400/500/600). No external font request at build/runtime (D-3; AGPL public repo, no Google
  Fonts). Files: `apps/web/src/fonts/*`, `apps/web/src/lib/fonts.ts`, `apps/web/src/app/layout.tsx`,
  `packages/ui/src/theme/globals.css` (shared token var() wiring). Branch `feat/self-hosted-fonts` `0560001`.
  Verified: typecheck/lint/build green + Playwright network (own-origin woff2 only, zero external font host).

