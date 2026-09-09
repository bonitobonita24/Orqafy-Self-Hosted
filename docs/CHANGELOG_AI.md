# CHANGELOG (AI) — Orqafy-Self-Hosted

Agent-attributed change log (Rule 3/15). Newest on top.

## 2026-09-09 — Document OCR + doc-matching pipeline (D-13 thin slice) [CLAUDE_CODE]
- **[FEATURE]** Implemented the real `ocr` + `document-matching` BullMQ processors in `@orqafy/jobs`
  (were no-op stubs). `ocr` processor: `storage.getObject` → POST to an offline OCR HTTP sidecar →
  persist `Document.ocrText`/`ocrStatus` → enqueue `document-matching`. Deterministic exact-ID matcher
  (`matching.ts`, `Project.code`/name, keyword category, NO LLM per D-13): single confident code hit
  auto-files (`Document.projectId`/`clientId` + `confirmed` DocumentReview @0.95), else a `pending`
  DocumentReview (match tray). `createProcessors(deps)` DI seam + `runtime-deps.ts`; 15 vitest unit tests.
  Files: `packages/jobs/src/{ocr,deps,matching,runtime-deps}.ts`, `worker.ts`, `main.ts`, `index.ts`
  + 4 `*.test.ts`. Commits `ccf02ee`…`eaeedf1`.
- **[FEATURE]** OCR sidecar (offline, profile-gated, R-5/D-13): `deploy/compose/ocr/` — RapidOCR
  (`rapidocr-onnxruntime`, ONNX, CPU-only) + `pdf2image`/poppler FastAPI service, `POST /ocr` multipart
  → `{text,engine,pages}`. Compose `ocr` service under `profiles:["ocr"]` (default dev stack unaffected);
  `worker` gets `OCR_URL=http://ocr:9003`. Commit `4f02877`.
- **[FIXED]** Dev Docker rebuild (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`): added repo-root
  `.dockerignore` (excludes `**/node_modules`, `.env*` w/ `!.env.example`, etc.) + `CI=true` on the worker
  install. **Cross-scope:** also fixes `Dockerfile.app`'s identical latent bug. Added `libgl1 libglib2.0-0`
  to the OCR image (opencv `libGL.so.1`). Closed 2 known TASK_QUEUE 🔴. Commit `af0d71d`.
- **[VERIFIED]** Live e2e from the **committed containers** (worker+ocr): real upload→OCR→text extracted
  → positive `PRJ-017` auto-filed (confirmed 0.95, category invoice) + negative no-code (pending 0).
  Evidence `test-artifacts/ocr-e2e-2026-09-09/`. Branch `feat/document-ocr-matching`, HARD HOLD local.

## 2026-09-09 — Self-hosted brand fonts [CLAUDE_CODE]
- **[FEATURE]** Self-host IBM Plex Sans + JetBrains Mono via `next/font/local` (vendored latin-subset OFL
  woff2, weights 400/500/600). No external font request at build/runtime (D-3; AGPL public repo, no Google
  Fonts). Files: `apps/web/src/fonts/*`, `apps/web/src/lib/fonts.ts`, `apps/web/src/app/layout.tsx`,
  `packages/ui/src/theme/globals.css` (shared token var() wiring). Branch `feat/self-hosted-fonts` `0560001`.
  Verified: typecheck/lint/build green + Playwright network (own-origin woff2 only, zero external font host).

