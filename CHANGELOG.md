# Changelog

All notable changes per release. A version is assigned at each push/merge to `main`;
entries are auto-derived from Conventional-Commit types. See
`~/.claude/rules/release-changelog-discipline.md`.

## v0.2.2 — 2026-11-01

### [FIXED]
- migrate zod 3 → 4.6.6 (HIGH memory-exhaustion advisory) (`07523b9`)


## v0.2.1 — 2026-10-31

### [FIXED]
- bump next to 15.5.28 (CRITICAL image-optimizer RCE) + override patched tooling deps (`2ee0697`)

### [DOCS]
- 2026-10-31 — v0.2.0 release, ORQ-59/60, PRODUCT back-port draft (`9261e8b`)


## v0.2.0 — 2026-10-31

### [FEATURE]
- orca product mark (Concept A) in sidebar, login, favicon (`7b60c9c`)
- self-service change-password page + admin reset-password dialog (`a1ae768`)
- invalidate web cookie sessions issued before passwordChangedAt (L-2 web) (`b713cf0`)
- invalidate mobile bearer tokens issued before passwordChangedAt (L-2 mobile) (`4c37b71`)
- changePassword + admin resetPassword, bump passwordChangedAt (`48b8df8`)
- add User.passwordChangedAt column + migration (`c6dadc2`)
- admin export/erase actions on Users page (DPA W8) (`4489084`)
- access audit log on document/photo downloads + SPI views (DPA W10) (`1a0d959`)
- Settings → Privacy page (DPO + retention) (DPA W7) (`dc4910c`)
- self-service "Download my data" (DPA W9) (`478be4f`)
- DPA retention sweep job, dry-run by default (DPA W6) (`a024b0b`)
- controller-operated user erasure, pseudonymize-in-place (DPA W5) (`ae1807a`)
- export-my-data (self + admin) (DPA W4) (`d2a6f88`)
- writeAudit helper + org DPO/retention settings router (DPA W3) (`04f7f61`)
- AuditLog.userId nullable for system actor (`fd2f4f6`)
- DPA privacy contracts (retention, org settings, export, erase) (`2704630`)
- User.anonymizedAt for DPA erasure (`1d74f55`)
- Rule 35 adaptive SEO baseline (robots, sitemap, metadata, noindex) (`4035f8f`)
- atomic Valkey-backed rate-limit store (`9dc8ffb`)

### [FIXED]
- record request IP on router and route-handler audit rows (`4fc6210`)
- make Session augmentation visible to api-client typecheck (`2894368`)
- use immutable authTime (not rotatable iat) for web session revocation (`5a17dcf`)
- rate-limit changePassword against password brute-force (`3d0ba8e`)
- reuse seeded system roles on first-run (no duplicate PermissionGroup) (`0db98c9`)
- enforce single Organization row (setup/seed reuse, deterministic lookup, dedupe migration) (`2f607d0`)
- export SPI gate parity + manage_users for on-behalf export (`ea0db24`)
- keep AuditLog actor FK ON DELETE RESTRICT (`1c9a454`)
- exclude verified-legitimate trust downgrades blocking worker build (`87e83ab`)
- rate-limit store honours REDIS_URL fallback like the job queue (`2004015`)
- dev-only CSP allowance for Next Fast Refresh (prod CSP unchanged) (`41ca850`)
- pass VALKEY_URL to the dev app so the rate limiter uses Valkey (`d324eff`)
- worker runtime ships prod deps only (audit L-10) (`2df91c6`)
- enforce upload cap while streaming (audit L-1) (`04d099b`)
- consume per-email limit atomically (close TOCTOU) (`0ef1c40`)
- constant-time auth compare + own input caps on the OCR sidecar (`25ec369`)

### [REFACTOR]
- single permission resolver for erase guard (`ef6e33f`)

### [DOCS]
- mark worker-bundle task done (ORQ-60) (`cccaf51`)
- mark audit request-IP task done (`6cd7517`)
- 2026-10-12 save — board sync wrap, loop stopped by owner (`6c95e39`)
- 2026-10-11 — ORQ-55 password reset (L-2 closed) + orca logo; 4 [WHAT]s resolved (`32e8c48`)
- back-port D-36/D-37/D-38 (ORQ-54 L-3 accept, ORQ-55 pw reset, ORQ-56 DPA confirm) (`b4749c3`)
- 2026-10-10 evening — follow-ups, audit LOW, Phase 5/6, v1 DPA (`a6e4af3`)
- close setup.ts PermissionGroup risk + Organization dedup (`b423343`)
- log agent-found setup.ts duplicate-PermissionGroup risk (`cf561ff`)
- reconcile 2026-10-10 follow-up + audit + DPA waves (`a803898`)
- record DPA wave default [WHAT]s (ORQ-56) (`159f0c0`)
- D-35 SEO posture — noindex everywhere, Lighthouse gate N/A (`cb3dde2`)
- D-34 accept 2 no-fix Expo dev-tooling CVEs (node-forge, braces) (`ef19136`)
- open L-3 doc-download scope + password change/reset [WHAT]s (`db6fd01`)
- queue 2 post-push review findings (OCR input cap, limiter TOCTOU); v0.1.1 CI green (`cb024f8`)

### [CHORE]
- keep supply-chain guards on runtime externals install (`b4661c9`)
- bundle worker image so its build resolves only the jobs dependency graph (`9cdfb42`)
- sync V32.54 → v32.67.6 + public-asset guard for new framework files (`e2c677d`)
- bump postcss override to latest patched 8.5.29 (L-8) (`7988e9c`)
- override decode-uri-component to patched 0.5.0 (L-6) (`03b6588`)
- harden pnpm-workspace.yaml against supply-chain attacks (L-5) (`4c1d6e1`)
- pin GitHub Actions to commit SHAs, add least-privilege permissions (L-4) (`6a18da6`)
- upgrade vite 5→8 / vitest 2→5 across all workspaces (ORQ-51, closes audit L-7/L-9) (`1166766`)


## v0.1.1 — 2026-10-10

### [FIXED]
- neutralize client Content-Type — download nosniff+sandbox, upload allowlist (audit M-5) (`1f02f74`)
- bind dev published ports to 127.0.0.1 only (audit M-4) (`2e6593c`)
- add security response headers — CSP, HSTS, nosniff, Referrer-Policy (audit M-3) (`087dac8`)
- resolve client IP from trusted proxy hop, not spoofable XFF (audit M-2) (`b47ee31`)
- require SETUP_TOKEN + race-safe single first-run admin (audit M-1) (`3729b95`)
- H-5 refresh stale base layers (apt/apk upgrade, drop bundled npm, nodemailer) (`e026d82`)
- harden OCR sidecar — dep bumps, non-root, shared-secret auth (audit H-4) (`47da244`)
- deny deactivated users on session/media/SSE paths + bound session maxAge (audit H-2) (`a567c50`)
- rate-limit web credentials login on the shared store (audit H-3) (`b378137`)
- gate SPI docs behind view_finances on update/delete/decideReview/reviewTray (audit H-1) (`e60d753`)

### [DOCS]
- D-33 close M-4b (repo dev-only), reconcile wave → v0.1.1 (`655ae9e`)
- M-1..M-5 done (9/9 un-gated audit fixes), release held on M-4b [WHAT] (`b4b6e2d`)
- defer M-4b prod-compose as [WHAT] (topology/deploy-posture, public-repo risk) (`31934fa`)
- H-5 stale base layers done (5/10), vite/vitest carve-out logged (`9dfa602`)
- H-4 OCR hardening done (4/10), anomaly resolved, Full Auto engaged (`0beba66`)
- v0.1.1 wave checkpoint — H-1/H-2/H-3 done (local branches), handoff + state (`dcef019`)
- save — D-30/31/32, v0.1.0 public release, audit findings queued for v0.1.1 (`b2c377e`)

### [TEST]
- mock resolveRequestUserId (H-2) in M-5 route tests — merge integration (`91f2601`)


## v0.1.0 — 2026-09-27

### [FEATURE]
- Orqafy product wordmark + favicon + Powerbyte footer credit (D-29) (`eceed30`)
- outbox hygiene — prune synced, re-drain, revive/retry, orphan-file sweep, pending-photo badge (ORQ-28) (`d375fdf`)
- scoped photo byte-download route + task-view thumbnails (ORQ-32) (`ec76903`)
- task-scoped photo capture screen + My Tasks entry point (`723dc3f`)
- photo/create outbox drain + retryable/permanent send errors (`5c6763a`)
- task-scoped photos.create + POST /api/photos upload (D-28) (`f845130`)
- photo key + document key validators (`81c6f90`)
- upload_photo permission + Photo.clientId (D-28) (`4e2301b`)
- chunk 5 phase B — My Tasks, Notifications, Apply-Leave screens + geofence arming (`597ade9`)
- chunk 5 phase A — login+gate, outbox runtime+mappings, security hardening (`7b606ea`)
- geofence integration — arm/re-arm + dwell notifications (wave chunk 4) (`83c3f3d`)
- auth client + login flow + Rule-13 eslint guard (mobile wave chunk 3b) (`66ded68`)
- mobile bearer-token auth path + superjson client (mobile wave chunk 3a) (`3d2d78e`)
- offline-first data layer — outbox + reconcile + sqlite adapter (mobile wave chunk 2) (`1abc877`)
- scaffold apps/mobile Expo SDK 54 app (mobile wave chunk 1) (`dc138a4`)
- document review tray + OCR-text search (`a4d1f2d`)
- add profile-gated RapidOCR sidecar + wire worker OCR_URL (`4f02877`)
- boot worker with real OCR + matching processors (`eaeedf1`)
- implement documentMatching processor (auto-file + review tray) (`ecb08af`)
- add deterministic exact-ID document matcher (D-13) (`c988462`)
- implement ocr processor (fetch->extract->persist->enqueue match) (`f8494f0`)
- add engine-agnostic OCR HTTP client (`64a9e72`)
- add vitest + createProcessors deps seam for OCR pipeline (`ccf02ee`)
- self-host IBM Plex Sans + JetBrains Mono via next/font/local (`0560001`)
- realtime board updates over tRPC SSE transport (D-22) (`e3484e1`)
- live kanban drag-drop with optimistic task.status persist (`c43ed89`)
- interactive Leaflet map picker for task geofence location (`93008dc`)
- document upload + management (`206c66d`)
- permission-builder editor UI (D-17) (`701d6b4`)
- leave workflow, milestones, and users management UIs (`583efad`)
- first-run /setup redirect fix + Client/Project/Task create-edit forms (`0581f4c`)
- dev Docker Compose bundle — Phase 4 Part 7 (`b6c7027`)
- Phase 4 Part 5 — apps/web (Next.js + tRPC + Auth.js v5) (`863a64a`)
- shared runtime packages — ui, storage, jobs, sync, geofence (Phase 4 Part 4 of 8) (`98a0505`)
- add @orqafy/db — Prisma schema, migration, seed for all v1 entities (`faae7e1`)
- root workspace config — Phase 4 Part 1 (`e5808f1`)
- Rule-22 dev ports + env files (P0.5) (`6f0cd01`)
- author inputs.yml + inputs.schema.json from D-1..D-24 (P0.3) (`aff44e5`)

### [FIXED]
- keep offline non-photo mutations pending for retry (ORQ-35) (`ad8849c`)
- friendly CONFLICT handling + retry in the Files upload form (ORQ-33) (`07d53f5`)
- recover post-crash committed photos instead of failing on missing file (ORQ-28 item 4) (`a66a055`)
- single canonical role-grant source; close seed↔first-run drift (ORQ-27) (`d7e1e95`)
- one Document per storageKey — closes SPI re-commit bypass (ORQ-26) (`4a4f04c`)
- bypass middleware body cap for upload routes (ORQ-31) (`47cf2ca`)
- CSPRNG outbox clientId via expo-crypto (no Math.random fallback) (`5b02b29`)
- content-length gate + upload rate limit (`a5317c0`)
- scope photo rows to assignee/oversight (`63c6efb`)
- immutable committed photos + owner-checked clientId (`c969494`)
- documents.create accepts only documents/<uuid>/<name> keys (`281b0f3`)
- tear down geofencing on sign-out (security review) (`b30dc86`)
- rate-limit POST /api/mobile/login (per-IP + per-email brute-force gate) (`628cba8`)
- silence benign @valkey/valkey-glide build warning (`64f4806`)
- make OCR Blob construction typecheck under the web app's DOM lib (`b59b086`)
- OCR sidecar libGL libs + repo .dockerignore for worker/app builds (`af0d71d`)
- add ?pgbouncer=true to pooled DATABASE_URL for host-run dev (`be54aee`)
- stop edge middleware from gating /api/trpc (first-run blocker) (`b9bd443`)

### [REFACTOR]
- extract mobile bearer identity for reuse by route handlers (`cb767c1`)

### [DOCS]
- back-port D-28 photo permission + D-29 branding (`2957d9b`)
- D-29 wordmark built+verified on branch; reconcile task queue + session log (`8f42b8f`)
- D-29 — Orqafy product-branded chrome (ORQ-37); footer keeps Powerbyte mark (`34debcc`)
- track official-logo/favicon adoption as owner-gated [WHAT] (branding) (`fee9d85`)
- main now carries V1 wave (FF from docs/tauri-wave-plan); HARD HOLD (`b599af2`)
- mark 9 gated open items with gate: fields (POW-13 Phase 1) — 0 un-gated (`811d60d`)
- reconcile — ORQ-28 stale open lines removed; Tauri/Expo annotated (all remaining items gated) (`3937158`)
- Full-Auto wave complete (ORQ-27/32/28/33/34/35 + Tauri R7a); handoff refreshed (`46bbccd`)
- Tauri desktop build wave plan (R7a) (`cf35d88`)
- ORQ-35 done — offline non-photo mutations retryable (`5fe9774`)
- ORQ-34 done — ESLint 9 flat-config migration (`320e5bc`)
- ORQ-33 done — Files CONFLICT UX (`7251e67`)
- ORQ-28 done (Pass A+B); log send.ts offline-retryable follow-up (`93ae6f2`)
- ORQ-32 done — scoped photo download route + thumbnails (`2d7c4ff`)
- ORQ-27 done — single canonical grant source, drift closed (`ed1f031`)
- ORQ-31/ORQ-26 live-verified; full-auto handoff (`6dee72f`)
- ORQ-31 + ORQ-26 done, live-verified (`618a3c3`)
- photo upload live-verified post-hardening (`5efc328`)
- photo capture ORQ-23 done; save session (`f7b7332`)
- ORQ-23 complete + SPI re-commit finding (`284924b`)
- ORQ-23 mobile half done (`e2940c4`)
- ORQ-23 server half done; log scoped photo-read + role-grant drift (`1daeb4f`)
- tidy resolved items (`e94208d`)
- D-28 — narrow task-scoped photo-upload permission (ORQ-23) (`d408e88`)
- POW-13 Phase 1 — declare gate: fields (centralized marking pass) (`c0c5260`)
- open [WHAT] — field-staff photo-upload permission (ORQ-23) (`a3cb753`)
- chunk 5 done+verified (build complete except photo capture); reconcile queue/state/log (`5b99e5e`)
- consolidate rate-limit branch into geofence tip; verify merged tree; next = chunk 5 (`9873da8`)
- rate-limit + geofence chunk 4 + teardown fix; next = consolidate branches then chunk 5 (`7ab2456`)
- mobile chunk 3 (auth + tRPC transport) whole + verified; close eslint follow-up (`eb5124f`)
- mobile chunk 3a (bearer auth server-side) done + live-verified; log rate-limit follow-up (`9f54367`)
- mobile wave chunk 2 (offline data layer) done + verified (`d168825`)
- mobile wave started — chunk 1 scaffold done + verified (`1602e81`)
- prod build green — <Html>/404 blocker resolved (not reproducible), valkey warning silenced (`1ed4e07`)
- review-tray + OCR-search done; log <Html>/404 prod-build blocker (agent-found) (`28355dd`)
- OCR + doc-matching pipeline done+verified; docker rebuild fixed; next = mobile/desktop (`c8ce891`)
- OCR + doc-matching pipeline implementation plan (`4eb60f9`)
- self-hosted fonts done + verified; next = Document OCR processors (`eaf3dea`)
- D-22 realtime SSE done + verified; next = self-hosted woff2 fonts (`530b37c`)
- live kanban drag-drop done + verified; log docker rebuild footguns (`0523823`)
- Leaflet map picker done + verified; next = remaining stubbed web features (`43f3136`)
- document upload/management done + verified; next = remaining web scope (`c97bfd6`)
- permission-builder editor UI (D-17) done + verified; next = document upload/management (`324c42b`)
- checkpoint — reconcile tip to feat/web-mgmt-forms; next = permission-builder (`eed6e29`)
- reconcile — Leave/Milestones/Users mgmt forms done; next = permission-builder (`b614da5`)
- checkpoint — web core v1 complete; reconcile queue + session log (`87f3b67`)
- finalize public-repo deliverables — LICENSE, README, CI (Phase 4 Part 8) (`662fc2e`)
- mark /setup redirect done; log web-forms done + agent-found items (`a0dd193`)
- reconcile cold-start sections — Parts 1-5+7 done, web runtime-verified (`7328546`)
- Phase 4 Part 7 done — compose bundle + runtime verification (`38701f9`)
- checkpoint — refresh stale STATE.md + log Phase 4 P1-4 progress (`6e22cbe`)
- record Phase 4 Part 4 — shared runtime packages scaffolded (`2c5a8c0`)
- Phase 0 done + D-26/D-27 session log (`aa1710b`)
- D-27 commercial model — cloud-storage add-on on Cloudflare R2 (`0097178`)
- D-26 web UI baseline = plain shadcn/ui + Kibo (`4f42568`)
- Phase 0 complete — exit gate (P0.6) (`df1d256`)
- Phase 0 scaffold plan + D-25 scaffold parameters (`c7481a1`)
- D-24 mockup approved + research cleared; session log (`3582b23`)
- integrate Phase-0-prep research — geofence, offline-first, packaging, sync (`87c93ab`)
- asset guard done; loop-iteration handoff + session log (`ffb7936`)
- correct stage to spec-approved / pre-scaffold (`8a00746`)
- mockup delivered for confirm; handoff + session log wrap (`1619c79`)
- save-session — handoff, memory, session log wrap (`c2aba44`)
- add Phase 2.8 visual-verification mockup (`f79db7c`)
- PRODUCT.md approved, write DESIGN.md, dispatch mockup (`cb446ac`)
- write PRODUCT.md from the Planning Assistant interview (`ad9ed48`)
- resolve v1 scope — D-13 AI phasing, D-14 sync client, D-15 remote access, D-16 AI hosting (`f90f50a`)
- lock D-10 Nextcloud, D-11 Tauri, D-12 document-AI feasibility (`80fbdc3`)
- capture document-AI feature request, dispatch R-5 feasibility (`352174e`)
- lock D-7 client platforms, D-8 TypeScript-only, D-9 dedicated VPS (`96a7ab6`)
- land R-1…R-4 research, queue two new owner decisions (`feb1a22`)
- lock D-5 single-company tenancy, D-6 sideload-only mobile (`96b9c71`)

### [CHORE]
- set initial app version 0.1.0 (`c042948`)
- set dev-compose restart policy to "no" (broadcast 2026-09-23) (`a79a7de`)
- migrate monorepo to ESLint 9 flat config (ORQ-34) (`136d146`)
- drop stale Playwright scratch snapshot; ignore .playwright-mcp/ (`e8f399d`)
- non-destructive Phase-0 bootstrap scaffold (P0.4) (`3d8701b`)
- seed AIEF framework locally + close audit-scope guard gap (P0.2) (`24c013b`)
- extend AGPL asset guard for framework tooling (P0.1) (`e8abbc5`)
- harden asset guard — case-insensitive + .sessions/ parity (`985481c`)
- enforce public-repo asset guard via git hooks (`99feae9`)
- found Orqafy-Self-Hosted — planning artifacts, no code (`98b696d`)

### [OTHER]
- @orqafy/shared + @orqafy/api-client — Phase 4 Part 2 of 8 (`de62d69`)

