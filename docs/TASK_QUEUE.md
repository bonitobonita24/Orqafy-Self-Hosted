# Task Queue — Orqafy-Self-Hosted

Fleet-standard task backlog (`task-capture-discipline.md`). Status: **TODO 🔴 · PARTIAL 🟡 · DONE ✅**.
Captures owner-dumped asks AND agent-found out-of-scope items. Distilled spec only — never raw prose.
Not a decisions log — owner-gated `[WHAT]`s live in `PENDING_DECISIONS.md`.

## 🔴 / 🟡 Open

_The three below are BLOCKED — they require real hardware / a running stack / a live tunnel, none of which
exist yet. They are NOT actionable now; they gate a later phase._

- 🔴 **[BLOCKED-hardware] Real-device geofence-over-tunnel test** (iOS + Android) before Phase 3 — needs
  physical devices + a live tunnel. R-1 found **no source** proving a VPN blocks geofence *triggering*;
  the open risk is notification *delivery* within the OS wake budget over an idle WireGuard tunnel.
  Decides whether the reverse-tunnel choice (Pangolin `newt`) is merely preferred or actually required.
  Done: measured trigger→delivery latency on both platforms, recorded in `docs/planning/R1_REMOTE_ACCESS.md`.
  `<source: agent-found 2026-09-06>`
- 🔴 **[BLOCKED-post-scaffold] Sync-engine resource-cost check** — needs the stack actually running.
  Measure idle and sync-load RAM/CPU on a desktop-as-server box already running Postgres + Valkey + MinIO
  before the choice is locked. Done: figures recorded in the winning engine's decision doc.
  `<source: agent-found 2026-09-06>`
- 🔴 **[BLOCKED-infra] Pangolin throughput test — BLOCKING before any customer install** — needs a live `gate: owner (HARD HOLD — needs live tunnel deploy)`
  tunnel deploy (HARD HOLD). Newt/Gerbil has maintainer-acknowledged sequential-packet processing:
  historically ~1–6 MB/s single-stream, reaching ~180 Mbit/s only with **Newt ≥1.16.0 +
  `USE_NATIVE_MAIN_INTERFACE=true` + host networking**. Those settings are mandatory in our bundle.
  Done: measured real throughput for a large photo upload over the tunnel, recorded in
  `docs/planning/R1a_PANGOLIN_SIZING.md`. `<source: agent-found 2026-09-06>`

### Post-v1 (deferred, not blocked)

- 🔴 **[POST-V1] Cloud-storage add-on + billing control plane** (D-27) — the paid monetization track: point
  the storage abstraction at **Cloudflare R2** per-subscriber bucket; build the hosted billing/subscription
  control plane (tiers Starter…Max, metering, payment gateway) OUTSIDE the OSS app. Ships after v1. Pricing +
  provider analysis: `docs/planning/R9_CLOUD_STORAGE_PRICING.md`. `<source: owner 2026-09-08>`

### Agent-found (Phase 4 build)


- 🟡 **[BENIGN] `jose`/Auth.js Edge-runtime `CompressionStream` build warning** — `next build` emits a single
  "A Node.js API is used (CompressionStream) which is not supported in the Edge Runtime" warning from
  `jose` (pulled in by `@auth/core`, which runs in the Edge middleware). Benign: `CompressionStream` is only
  used for JWE `zip`-compressed tokens, which Auth.js does NOT use for its default JWT sessions. Pre-existing,
  third-party, no runtime effect. Left as-is (any suppression would be a hack into a dependency's Edge path).
  Do NOT re-investigate. `<source: agent-found 2026-09-09>`
- 🔴 **[mobile] Offline non-photo mutations fail on first attempt** — `send.ts` error classification leaves an
  offline task/update `create`/`update`/`delete` failing on the first drain rather than staying `pending`
  (only photo/create currently classifies network errors as retryable). Make transport/offline errors
  retryable for all entity ops so queued edits survive being made offline. `<source: agent-found 2026-09-26>`
- 🔴 **`Document.size` Int→BigInt** if single files >2GB are expected (Prisma schema + Zod). Construction
  drawings are usually well under, so Int is fine for v1 — revisit if large-file uploads surface.
  `<source: agent-found 2026-09-08>`
- 🔴 **[mobile][BLOCKED-hardware] On-device chunk-5 verification** — the chunk-5 screens + geofence arming are
  static+unit verified only (no device here). Exercise login→My Tasks→mark-done→Leave→Notifications + live
  geofence arm/dwell on a real device when hardware exists (ties to the existing BLOCKED-hardware geofence task).
  ALSO (ORQ-23, 2026-09-26): My Tasks "Photo" → camera permission/denied → capture offline → drain uploads
  (`POST /api/photos` + `photos.create`) → local file deleted; confirm RN multipart sends a Content-Length
  (server returns 411 otherwise — source-level evidence says yes on both platforms, unverified).
  `<source: agent-found 2026-09-10>`
- 🔴 **[mobile] Pending-photo badge on My Tasks** — `useOutbox` exposes no entry list, so a per-task count of
  pending `photo/create` entries needs new runtime plumbing (list + change notification). Done: badge shows N
  queued photos per task, clears after drain. `<source: agent-found 2026-09-26>`
- 🔴 **[mobile] Outbox hygiene follow-ups** — (1) `synced` entries are never pruned from sqlite; (2) `failed`
  entries have no UI / manual retry (photo files of permanently-failed entries stay in documents/photos);
  (3) a capture enqueued DURING an in-flight drain waits for the next mount/foreground trigger; (4) if a drain
  deletes the local file but crashes before persisting `synced`, the re-drain fails permanently on "missing
  file" although the photo IS committed server-side (benign, but mislabelled — fix: on missing file call
  `photos.create` with the deterministic key instead of failing); (5) a `photo/create` entry that
  stays retryable for 25 drains (e.g. signed out for days) goes terminal `failed` — no UI to revive it.
  `<source: agent-found 2026-09-26>`

### Remaining web scope (finish before mobile — web-first, D-25/W-1)

- ✅ **Entity forms — DONE** — Leave (apply/approve) · Milestones · Users (create/edit + role assign)
  (`feat/web-mgmt-forms` 583efad) · **Permission-builder editor UI (D-17)** (`feat/web-permission-builder`
  701d6b4) · **Document upload + metadata form** (`feat/web-document-management` 206c66d). All runtime-verified.
- ✅ **Stubbed web features — DONE** — ~~live kanban drag-drop~~ ✅ (`feat/web-kanban-dnd` c43ed89) ·
  ~~realtime transport (D-22)~~ ✅ **SSE** (`feat/web-realtime-sse` e3484e1) · ~~self-hosted woff2 fonts~~ ✅
  (`feat/self-hosted-fonts` 0560001) · ~~OCR/matching processors~~ ✅ (`feat/document-ocr-matching` af0d71d).
  `<source: agent-found 2026-09-08>`
- 🟡 **Expo mobile (Part 6)** — BUILD COMPLETE except photo capture + hardware-blocked device tests (wave
  plan: `docs/tasks/mobile-wave-plan.md`; tip branch `feat/mobile-chunk5-screens`). ✅ **Chunks 1–5 DONE +
  verified** (static+unit bar; NO device). ✅ **Chunk 1 scaffold DONE + verified** (`dc138a4`): `apps/mobile` Expo SDK 54
  (expo ~54.0.37 / expo-location ~19.0.8 / expo-task-manager ~14.0.9), config-plugin bg-geofence permissions,
  monorepo Metro, expo-router tab shell, RN theme from `@orqafy/ui/theme` values; tsc+eslint+`expo config`
  green, Rule 13 clean. ✅ **Chunk 2 offline data layer DONE + verified** (`1abc877`): pure outbox (idempotent
  by client UUID) + reconcile (record-level LWW + soft-conflict + tombstones) + drainOutbox (injected send
  seam), 29 vitest green, split from a typecheck-only expo-sqlite adapter (cache_records/outbox/tombstones/
  sync_meta). ✅ **Chunk 3a auth server-side DONE + verified LIVE** (`3d2d78e`): mobile bearer-token path in
  `apps/web` (jose HS256 alg-pinned, identity-only claim, per-request isActive re-check, header-only, uniform
  401, `/api/mobile/login` Node route, `PUBLIC_PREFIXES` fix) + `createOrqafyClient` superjson+subscription
  link; cookie path preserved; 7 unit + web build + **5 live tests** (login 200+token, bad-pw 401, bearer→
  auth.me 200+10 perms, no/garbage bearer 401). ✅ **Chunk 3b mobile-side DONE + verified** (`66ded68`):
  SecureStore token store + `createAuthedClient` (Bearer header) + `login()`/`logout()` + `useAuth()` context
  + outbox `SendFn` seam (typed registry, mappings deferred to chunk 5) + Rule-13 `no-restricted-imports`
  eslint guard (probe-confirmed); tsc+lint+31 vitest green. **Chunk 3 (auth) WHOLE.** ✅ **Chunk 4 geofence
  integration DONE + verified** (`feat/mobile-geofence`): `apps/mobile/src/geofence/` — pure adapter
  (region/event-type mapping, iOS-20-cap arm selection) + module-scope `defineTask` (registration proven by
  unit test) + dwell via scheduled `TIME_INTERVAL` notification (arm-on-Enter/cancel-on-Exit, no double-fire) +
  `armGeofences`/`stopGeofences` permission+arming service; 43 vitest green (+12), tsc/lint/`expo config`/Rule-13/
  asset-guard clean. NOT device-tested (hardware-blocked). ✅ **Security-review teardown fix** (`b30dc86`):
  sign-out left geofences armed (previous user's sites kept alerting; a pending dwell could still fire) →
  `teardownGeofencing()` wired into `signOut` + the token-invalid hydrate branch; 46 vitest. ✅ **Branches
  consolidated** (`2e10551`, 2026-09-10): `fix/mobile-login-rate-limit` merged into the `feat/mobile-geofence`
  tip; merged tree re-verified (web tsc + 13/13 vitest + eslint green). ✅ **Chunk-4 finding #4 ADJUDICATED**
  (`fix config.ts`, 2026-09-10): the un-surfaced 4th finding = cleartext-transport of creds+bearer token when
  API_URL is non-localhost http (D-15 LAN-first). ACCEPTED for v1 (beyond-LAN path is TLS-terminated by the
  BLOCKED Pangolin tunnel) with 3 hardenings folded into chunk 5. ✅ **Chunk 5 core screens DONE + verified**
  (`feat/mobile-chunk5-screens`, 7b606ea + 597ade9): login+gate · outbox runtime+mappings · My Tasks · Notifications
  · Apply-Leave + Leave tab · geofence arming-caller (has-location ∩ active-window authz filter) · 3 security
  hardenings. mobile tsc 0 · eslint 0 · vitest 64/64 · expo config resolves · Rule-13 clean. NOT device-tested.
  **Photo capture carved out → separate task (ORQ-23): no server photos.create + manage_files RBAC question.**
  `<source: plan 2026-09-08>`
- 🔴 **Tauri desktop** — later wave (own sessions): Tauri client + Rust sync sidecar (D-11/D-14).
  `<source: plan 2026-09-08>`
- 🔴 **[POST-V1, security] Valkey-backed rate-limit store** — the mobile-login limiter is in-memory (resets on
  restart, per-instance). Drop in a Valkey `RateLimitStore` adapter at the `getRateLimitStore()` SEAM for
  restart-durable / multi-instance limiting when the app graduates past single-process. `<source: agent-found 2026-09-10>`

## ✅ Done recently

- ✅ **ESLint 8→9 flat-config migration (ORQ-34)** — all 10 workspaces off EOL ESLint 8.57.1/legacy `.eslintrc`
  to ESLint 9.39.5 flat config (`eslint.base.mjs` shared base + per-workspace `eslint.config.mjs`;
  typescript-eslint v8; web needed no eslint-config-next/FlatCompat — it lints plain `src` globs). Every
  rule/override/ignore/env reproduced (no relaxation): recommendedTypeChecked, the 3 base rules + web's 6
  relaxations, reportUnusedDisableDirectives off, dot-dir ignores restated. Real v8-surfaced violations fixed
  properly (no disables). Rule-13 mobile no-restricted-imports guard re-proven (PM re-ran the probe: banned
  `@orqafy/ui`/`@orqafy/db` imports error with the exact message, then reverted clean). Gates: `pnpm -r lint` 0
  across 10 workspaces, web/mobile/db tsc clean, vitest web 130 / mobile 145 / shared 13, `expo config` OK.
  (`136d146`, branch `chore/eslint9-flat-config`, 2026-09-26)
- ✅ **[web] Friendly `documents.create` CONFLICT handling + retry in the Files form (ORQ-33)** — pure testable
  mapper `conflict-error.ts` (`isConflictError`/`conflictMessage`); on tRPC CONFLICT the form shows "This file
  was already uploaded. Please choose the file again to retry." (app's inline `text-destructive` convention),
  drops the staged file + `create.reset()` so a fresh upload mints a new storageKey; other errors unchanged;
  server/upload pipeline untouched. Gates green: web tsc/eslint + vitest 130 (conflict-error 6). Live browser
  repro deferred (no web server). (`07d53f5`, branch `fix/files-conflict-ux`, 2026-09-26)
- ✅ **[mobile] Outbox hygiene + pending-photo badge (ORQ-28)** — Pass A (`d375fdf`, branch
  `fix/mobile-outbox-hygiene`): prune synced rows post-drain (failed kept as dead-letter); close single-flight
  gap (re-drain when a capture lands during an in-flight drain, bounded ×3); revive/retryAllFailed; discard +
  free lingering local photo file; age-guarded orphan-photo-file sweep; pure countPending/failedEntries/
  partitionDrained/reviveEntry/orphanPhotoFiles selectors; My Tasks pending-photo badge + failed-upload
  retry/dismiss banner via reactive useOutboxStatus. Pass B (`a66a055`, branch `fix/photo-idempotent-recovery`,
  item 4): capturer-scoped `photos.existsByClientId` (bytes-free, no oracle) — a missing-local-file drain now
  confirms server-side commit by clientId and marks done, permanent only when never committed / retryable when
  the check itself fails. Gates green: web tsc/eslint + vitest 124; mobile tsc/eslint + vitest 145 + `expo
  config`. Static+unit bar (no device — post-crash sequence + badge render deferred to device). 2026-09-26.
- ✅ **[server][security] Scoped photo byte-download route + web thumbnails (ORQ-32)** — `GET /api/photos/[id]`
  serves bytes only to viewers allowed by the shared photo-policy (`canReadStoredPhoto` → `canViewTaskPhotos`
  assignee-OR-oversight for task photos; oversight-only for milestone photos). Missing + denied + bytes-gone are a
  byte-identical 404 (no existence oracle on GPS rows); 401 only when unauthenticated; `nosniff` + inline
  `Content-Disposition` + `private, no-store`; storageKey read only from the DB row. Logic in a testable
  injected-deps handler (`photo-download.ts`) + 13-case allow/deny vitest matrix; web `TaskPhotoStrip` renders
  scoped thumbnails in the task dialog (no storageKey exposed). Gates green: tsc/eslint clean, vitest web 121.
  Live curl DEFERRED (no web server running; env step). Note: unscoped `tasks.byId`/`listByProject` METADATA
  reads are intended for this single-org install (D-5: authenticated = org member); only GPS photo BYTES need
  per-assignee scoping, now done. (`ec76903`, branch `fix/photo-download-scope`, 2026-09-26)
- ✅ **[rbac] Single canonical role-grant source — seed↔first-run drift closed (ORQ-27)** — grants moved to
  `@orqafy/shared/roles`; the db seed (`packages/db/prisma/seed.ts`) and web first-run (`setup.ts` via
  `apps/web/src/server/roles.ts` re-export) now consume ONE source. roles.ts's richer values canonical
  (project_manager gains view_all_projects+export_data; accountant gains manage_files). Added
  `packages/shared/src/roles.test.ts` parity/regression tripwire. tsc shared/db/web + eslint + vitest
  (shared 13, web 101) green; photo-policy F2 drift comment updated. Static+unit verified; live seed/first-run
  re-seed is an env step. (`d7e1e95`, branch `fix/rbac-grants-single-source`, 2026-09-26)

- ✅ **Middleware 10 MB body cap on upload routes (ORQ-31)** — the middleware `matcher` now skips `/api/photos` and
  `/api/media` (+ `/api/media/[id]`); their handlers authenticate themselves. Matcher regression test with Next's own
  matcher compiler. Live: 12 MiB photo → 200 + `photos.create` 200, 17 MiB → 413, chunked → 411, 20 MiB document →
  200 + `documents.create` 200; unauthenticated upload/download → 401 (no redirect). (`47cf2ca`, 2026-09-26)
- ✅ **One Document per storageKey — SPI re-commit bypass closed (ORQ-26)** — `Document.storageKey @unique`
  (additive migration; dev DB had no duplicates) + `documents.create` rejects a used key (CONFLICT, generic message),
  maps a racing P2002 to CONFLICT, and requires the object to exist in storage. Live: re-committing an SPI key as
  non-SPI → 409 for owner and project_manager; project_manager still gets 403 on the SPI download. (`4a4f04c`, 2026-09-26)
  Evidence for both: `test-artifacts/photo-upload-2026-09-26/orq31-orq26.md`.

- ✅ **Re-run live photo-upload tests POST-hardening (ORQ-29)** — all 14 checks pass live: bearer and cookie
  paths, 409/403 clientId immutability, 411/413/415/400, 429 + Retry-After, F2 read scoping, and a web
  Files/dashboard regression. Found the 10 MB middleware truncation bug (see Open). Evidence:
  `test-artifacts/photo-upload-2026-09-26/post-hardening.md` (2026-09-26)

- ✅ **[security][mobile] Outbox clientId no longer falls back to Math.random** (2026-09-26, `5b02b29`) —
  `expo-crypto` ~15.0.9 `randomUUID` injected into a pure `createUuidGenerator` (`uuid.ts`, lowercases +
  validates v4, THROWS with no CSPRNG source) bound in `uuid-native.ts`; `Math.random` path removed; comment
  now states the id is a capability key (F1/D-28). Stale `runtime.ts` "fail permanently" comment corrected.
  mobile tsc 0 · eslint 0 · vitest 125/125 · `expo config` 0 · asset guard clean.

- ✅ **Site-photo capture upload path** (ORQ-23 / D-28) (2026-09-26, `feat/mobile-photo-capture`). Server half
  `f845130`…`1daeb4f`; mobile half `5c6763a` (outbox `photo/create` drain: multipart `/api/photos` → `photos.create`
  with the outbox clientId, revived Date, delete-after-commit; 409+storageKey reuse; typed Permanent/Retryable send
  errors — retryable now stays pending up to 25 attempts, previously every failure was terminal) + `723dc3f`
  (capture screen, hidden route, My Tasks "Photo" action). Static+unit only: tsc 0 · eslint 0 · vitest 122/122 ·
  `expo config` resolves the camera plugin. On-device pending under the BLOCKED-hardware chunk-5 item.
  **COMPLETE — merged tip `c494f98`** (merge of `fix/photo-upload-hardening` `a5317c0`, F1–F5: committed-clientId
  immutability 403/409, assignee-or-oversight photo reads in `tasks.byId`/`dashboard.summary`, Content-Length
  411/413 gate before `formData()`, per-user upload rate limit, MIME-trust note). Combined re-verify 2026-09-26:
  tsc 0 ×6 pkgs · eslint web+mobile 0 · vitest web 80 / storage 23 / mobile 122 · web build 0 · `expo config` 0 ·
  asset guard clean. Server live-verified pre-hardening only; on-device BLOCKED-hardware.

- ✅ **Rate-limit `POST /api/mobile/login` (brute-force protection)** (2026-09-10, `fix/mobile-login-rate-limit`).
  Closes the chunk-3a security follow-up (endpoint had no brute-force protection). New DI'd limiter
  `apps/web/src/server/rate-limit.ts`: in-memory fixed-window store behind a `RateLimitStore` interface
  (`incr`/`get`/`reset`), globalThis singleton, `clientIp()` (XFF-leftmost → x-real-ip, front-proxy-trust
  documented), env-overridable limits (`MOBILE_LOGIN_IP_MAX`=20 · `MOBILE_LOGIN_EMAIL_MAX`=5 ·
  `MOBILE_LOGIN_WINDOW_SEC`=900). Two dimensions: per-IP counter (every attempt) + per-email **failure**
  counter (read-only in the check so checking never self-locks; incremented only on real failures; reset on
  success). **Fail-open** on any store error (never block a legit login on limiter failure). Route returns
  `429 {error:'Too many attempts'} + Retry-After` before the DB lookup; uniform 401 / no-enumeration preserved.
  6 vitest cases (IP over-limit, email lockout, success-reset, window-expiry, fail-open, email canonicalization).
  Verified: web test 13/13 · tsc · eslint · asset-guard all green (re-run independently). In-memory = accepted
  single-process v1 posture (same precedent as the SSE bus); Valkey adapter is a documented `getRateLimitStore()`
  SEAM, logged as POST-V1. NOT live-429-tested (endpoint is localhost-only until the exposure this guards).
  AGPL guard clean, HARD HOLD local.
- ✅ **Production `next build` is GREEN — HIGH `<Html>`/404 blocker resolved + valkey warning silenced**
  (2026-09-09, `fix/prod-build-clean`, `64f4806`). The previously-logged HIGH blocker (`<Html> should not be
  imported outside pages/_document` on default `/404` static-gen) **no longer reproduces**: two clean
  `rm -rf .next && pnpm --filter @orqafy/web build` runs each exit 0, generate all 6 static pages (incl.
  `/_not-found` as static ○), zero `<Html>` errors. Root cause of the original failure was almost certainly
  the pre-`b59b086` ocr.ts BlobPart issue distorting the server module graph feeding the `/_error` chunk
  (compounded by a stale `.next`); the ocr.ts fix cleared it — no code change was needed for the 404 itself.
  Separately silenced the benign BullMQ `@valkey/valkey-glide` "Module not found" warning via a webpack
  `IgnorePlugin` on that exact optional module in `apps/web/next.config.mjs` (we use ioredis; the glide path
  is never taken) — verified gone, build still exit 0, the `/api/trpc`→jobs→bullmq route still bundles. Only
  remaining build warning is the benign `jose`/Edge `CompressionStream` note (see Open, left as-is). AGPL
  guard clean, HARD HOLD local. **Prod/docker image build path is now unblocked.**
- ✅ **Document review-tray + OCR-text search UI** (2026-09-09, `feat/document-review-search`, tip `b59b086`).
  The two remaining web surfaces over the D-13 OCR pipeline. **Review tray** (`/review`, new `Inbox` nav entry):
  lists pending `DocumentReview` rows (`documents.reviewTray`) with per-row **Confirm** (accept the auto-filer
  suggestion) and **Reassign** (pick project/client/category) → `documents.decideReview`; invalidates
  reviewTray+list+unsortedCount+dashboard.summary; graceful FORBIDDEN/empty/loading. **OCR-text search**
  (`/files`): `documents.list` gains optional `q` → case-insensitive `ocrText contains` (v1; tsvector+GIN is
  the noted graduation path) + a search box. Verified LIVE on the dev stack (Playwright + DB + tRPC 200s):
  reassign persisted (review=reassigned, doc re-filed to chosen project+category, pending 1→0); search
  q=RANDOM→1, q=invoice→2 (case-insensitive), q=zzznomatch→empty. web+jobs tsc + web eslint + jobs 15 tests
  green; AGPL guard clean; HARD HOLD local. ⚠ `next build` static-gen still blocked by a **pre-existing**
  `<Html>`/404 issue (logged agent-found, HIGH) — feature is dev/runtime-verified, prod build is a separate
  open blocker.
- ✅ **Build-gate fix: OCR Blob typecheck under web DOM lib** (2026-09-09, `b59b086`). `new Blob([Uint8Array])`
  failed the web app's stricter tsc (`Uint8Array<ArrayBufferLike>` ⊄ `BlobPart`) — blocked the `next build`
  type gate though `@orqafy/jobs`' own tsc accepted it. Fixed with `input.body.slice().buffer as ArrayBuffer`
  (valid in both libs, runtime-identical). Cross-scope (OCR-worker path, touched only to restore the shared
  gate; worker rebuild picks it up, behaviour identical). Lesson
  `typescript.monorepo.uint8array-blobpart-cross-tsconfig`.
- ✅ **Document OCR + doc-matching pipeline (D-13 thin slice)** (2026-09-09, `feat/document-ocr-matching`, 8 commits, tip `af0d71d`). The `ocr` + `document-matching` BullMQ processors are now real: the worker fetches bytes via `@orqafy/storage`, POSTs to a **profile-gated offline RapidOCR HTTP sidecar** (`deploy/compose/ocr/` — no OCR lib in the TS repo, per R-5/D-13), persists `Document.ocrText`/`ocrStatus`, then runs a deterministic exact-ID matcher (`Project.code`/name, NO LLM) that auto-files a confident hit (`Document.projectId`/`clientId` + a `confirmed` DocumentReview @0.95) or writes a `pending` DocumentReview to the match tray. `createProcessors(deps)` DI seam; 15 vitest unit tests. Live e2e verified **from the committed containers** (worker+ocr, no host workaround): positive `PRJ-017`→confirmed 0.95 invoice + negative no-code→pending 0. Evidence: `test-artifacts/ocr-e2e-2026-09-09/`. AGPL guard clean, HARD HOLD local. Follow-up (agent-found): review-tray + full-text-search **UI** surfaces — data is correct, screens may not exist yet.
- ✅ **Docker dev-build fixes (closed 2 known 🔴)** (2026-09-09, `af0d71d`). Root-caused `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: no repo `.dockerignore` → host `node_modules` (~1.3GB) shipped into the `../../..` build context → pnpm refuses to purge without a TTY. Added repo-root `.dockerignore` (`**/node_modules`, `.git`, `.next`, `dist`, `test-artifacts`, `.env*` with `!.env.example`) + `CI=true` on the worker install line. **Cross-scope note:** the `.dockerignore` also fixes `Dockerfile.app`'s identical latent bug. Also added `libgl1 libglib2.0-0` to the OCR image (opencv/cv2 needs `libGL.so.1`). Both images build + boot clean, container-verified.
- ✅ **Self-hosted brand fonts (woff2)** (2026-09-09, `feat/self-hosted-fonts` 0560001). Vendored IBM Plex
  Sans + JetBrains Mono as latin-subset OFL woff2 (weights 400/500/600 — scoped to `font-medium`/
  `font-semibold`/body; no 700 in the UI) under `apps/web/src/fonts`, loaded via `next/font/local`
  (`apps/web/src/lib/fonts.ts`), classes applied to `<html>` in `layout.tsx`. Shared `@orqafy/ui`
  `theme/globals.css` now consumes `--font-plex-sans`/`--font-jetbrains-mono` via the var() FALLBACK form.
  Result: **no external font request** at build/runtime (D-3 offline-first + no Google Fonts in the AGPL
  public repo). Verified: typecheck/lint/build green; Playwright — all 6 faces served from
  `/_next/static/media/*.woff2` (200), zero googleapis/gstatic/jsdelivr requests, `--font-sans` resolves
  fontSans-first + weights loaded. OFL license text vendored beside the fonts. HARD HOLD local.
- ✅ **Realtime board updates over SSE (D-22)** (2026-09-09, `feat/web-realtime-sse` e3484e1). Wired the
  in-memory `realtimeBus` to a live carrier: tRPC v11 SSE over the existing Next.js fetch route handler
  (`force-dynamic`) + client `httpSubscriptionLink`/`splitLink` — no WS server / custom Next server needed
  (single-process self-hosted, D-3); Auth.js cookies flow same-origin. New `tasks.onBoardChanged` subscription
  (`board:changed`/`task:updated`, per-project) → board page invalidates `projects.byId` on each event.
  Playwright **two-client** verified: a task change in client A appeared live in client B with **no reload**;
  both held a persistent SSE stream; onData fired on both; no server errors. Scale seam noted (in-memory bus →
  Valkey pub/sub for multi-instance, POST-V1). Static gates green, AGPL guard clean, HARD HOLD local.
- ✅ **Live kanban drag-drop** (2026-09-09, `feat/web-kanban-dnd` c43ed89). Replaced the static board stub
  with real `@dnd-kit/core` DnD: droppable columns keyed to `TaskStatus`, draggable cards, Pointer+Keyboard
  sensors, `onCardMove` fires only on cross-column drops → `tasks.move` mutation with react-query v5
  optimistic update (snapshot + setData, onError rollback, onSettled invalidate). Kept the existing themed
  look (subtle drag/over affordances only). Static gates green (ui/web typecheck, lint, build); Playwright
  runtime-verified on the live stack — dragged a card To-do→Blocked, DB persisted `status=blocked`, survived
  a full page reload. AGPL guard clean, HARD HOLD local.
- ✅ **Leaflet map picker for task geofence** (2026-09-09, `feat/web-map-picker` 93008dc). Interactive MapPicker
  in `@orqafy/ui` (click/drag to set anchor, radius→circle preview, inline-SVG pin, env-configurable OSM tiles),
  ssr:false subpath-exported to dodge the server-side leaflet crash; task-form two-way bound (map writes lat/lng
  6dp, numeric inputs retained); `parseGeofenceStrings` +8 vitest. Static green + Playwright runtime-verified
  (tiles load, click→coords→circle, created task persisted location JSON to DB). AGPL guard clean, HARD HOLD local.
- ✅ **Document upload + management** (2026-09-09, `feat/web-document-management` 206c66d). Server-proxied
  `/api/media` upload (StorageAdapter, no browser-direct presign) + `/api/media/[id]` gated download +
  documents `create`/`update`/`delete` (`manage_files`) + a Files-page upload dialog with per-row
  download/edit/delete + Restricted badge; wired `@orqafy/storage`+`@orqafy/jobs` into web, `buildDocumentKey`
  traversal-safe helper (+10 vitest). Runtime-verified (Playwright + live stack): upload→MinIO object at safe
  key + `bull:ocr` job + DB row; download real bytes; edit (project preserved); delete cascades row+object.
  Fixed an async-select prefill data-loss bug found in verification (lesson
  `react-hook-form.async-select.prefill-data-loss`). Green, AGPL guard clean, HARD HOLD local.
- ✅ **Permission-builder editor UI (D-17)** (2026-09-09, `feat/web-permission-builder` 701d6b4). Custom
  permission groups (create/edit/delete on `/settings/roles`; system-group name locked, permissions editable,
  no delete) + per-user overrides dialog on the Users table (3-state Inherit/Force-grant/Force-revoke over the
  role+group base). New dependency-free `Checkbox` in `@orqafy/ui`; no server changes (API already existed).
  Runtime-verified (Playwright+live DB): created/edited/deleted a custom group, confirmed system name-lock,
  set+persisted+cleared a per-user override. typecheck/lint/build green, AGPL guard clean, HARD HOLD local.
- ✅ **Web management UIs — Leave / Milestones / Users** (2026-09-08, `feat/web-mgmt-forms` 583efad). Leave
  apply + approve/reject (D-21) · Milestone create/edit on project detail · Users list/create/edit + role
  assignment (D-17, role-assign only — permission-builder deferred). Added a minimal `milestones` router.
  Runtime-verified (Playwright+DB): created a User+role, a Milestone, applied+approved Leave. Green, boundary
  clean, HARD HOLD local.
- ✅ **`dashboard.summary` 500 + host-run PgBouncer error — FIXED** (`fix/web-dashboard-pgbouncer` `be54aee`,
  2026-09-08). Single root cause: pooled `DATABASE_URL` missing `?pgbouncer=true` (transaction pooling +
  Prisma named prepared statements collide); the dashboard 500 was a *symptom*, not a separate bug. Fixed in
  `.env.example` (tracked) + `.env.dev`; verified dashboard 200 with KPIs + list query over the pooled URL.
  Lesson `prisma.pgbouncer.missing-pgbouncer-true-prepared-stmt`.
- ✅ **Web core v1 — Parts 5, 7, 8 (FULL AUTO, 2026-09-08)** — `apps/web` (Next.js+tRPC+Auth.js v5, plain
  shadcn/Kibo) built; dev Compose bundle live runtime-verified (first-run→login→dashboard→CRUD); LICENSE
  (AGPL-3.0) + README (honest status + quickstart) + `.github/workflows/ci.yml` (no publish). All green,
  boundary verified after each step, HARD HOLD local.

- ✅ **Web usable end-to-end — first-run redirect fix + create/edit form UIs** (2026-09-08,
  `feat/web-create-forms`). Fixed the first-run entry (`/` now reaches its RSC → 0 users → `/setup`; login
  links to setup when needed; auth still enforced elsewhere). Built Client/Project/Task create+edit form
  dialogs (react-hook-form + zodResolver bound to `@orqafy/shared`, wired to existing tRPC mutations) + a
  `/clients` admin page + New/Edit affordances on projects & the project board; added `Textarea`/`Select`
  to `@orqafy/ui`. Static green (build/typecheck/lint/prettier). Runtime-verified via Playwright on a fresh
  DB: `/`→`/setup` → create admin → login → **create Client → Project → Task (with geofence) via the FORM
  UIs** → persisted after reload (+ client edit). AGPL guard clean, no framework IP tracked. HARD HOLD local.

- ✅ **Phase 4 build (FULL AUTO) — Parts 1–4** (2026-09-08): root config (`feat/phase4-part1`) · `@orqafy/shared`
  Zod + `api-client` (part2) · `@orqafy/db` Prisma no-tenant + R-4 seed override (part3) · `ui`/`storage`/`jobs`/
  `sync`/`geofence` runtime packages (part4). All typecheck/lint/test green, AGPL boundary verified after each
  Part, HARD HOLD local. **Next: Part 5 `apps/web`.**

- ✅ **MOCKUP.jsx — owner-approved** (2026-09-08). Dashboard PNG delivered + confirmed; design gate cleared,
  Phase 0 scaffold unblocked. (`docs/MOCKUP.jsx`, `mockup-dashboard.png`.)
- ✅ **Verify Expo background-geofencing (context7)** → `docs/planning/R6_EXPO_GEOFENCING.md` + PRODUCT.md
  mobile section. Background Enter/Exit confirmed on iOS+Android via `startGeofencingAsync` +
  `TaskManager.defineTask`, **native-build-only**; iOS 20-region cap (app re-arms nearest active tasks);
  Enter/Exit-only (no native dwell → app-side 3-min timer); Always permission. On-device/offline confirmed
  (one literal "no network" claim flagged unverified). (2026-09-08)
- ✅ **Offline-first mobile design (D-15)** → PRODUCT.md mobile section + DESIGN.md §8. Cached read model,
  local OS geofence eval with no server contact, durable ordered outbound queue (client-id idempotency),
  reconnect conflict handling (LWW + monotonic completion + tombstones). (2026-09-08)
- ✅ **Desktop packaging workstream (Tauri, D-11)** → `docs/planning/R7_DESKTOP_PACKAGING.md` + DESIGN.md §9.
  Per-platform signing (macOS notarytool / Windows Authenticode / Linux GPG), minisign auto-update from our
  own domain (AGPL, no store), and the 7-point Rust sidecar-supervision surface as the sole non-TS code.
  (2026-09-08)
- ✅ **Verify headless Nextcloud continuous-sync approach (D-14)** → `docs/planning/R8_NEXTCLOUD_SYNC.md`.
  `nextcloudcmd` confirmed one-shot (no daemon/interval/watch flag). v1 recommendation: supervise
  `nextcloudcmd` from the Rust sidecar via debounced fs-watch + periodic timer, serialized per project
  folder; WebDAV-in-client is the fallback behind a `FileSyncProvider` port. Follow-up: verify
  `nextcloudcmd --help` on the actually-bundled binary. (2026-09-08)

- ✅ **Public-repo asset guard** — `scripts/check-public-assets.sh` (`--staged`/`--tracked`) +
  `scripts/install-git-hooks.sh` wiring pre-commit/pre-push. Refuses `.ai_prompt/`, `AI/`,
  `starter/admincn/`, `.claude/`, `CLAUDE.md`. Verified: a force-added `.ai_prompt/` commit was refused.
  README contributor note added. (`chore/asset-guard`, 2026-09-08).
- ✅ **README stage refreshed** — corrected "pre-spec / interview not yet run" → "spec approved ·
  pre-scaffold" (`docs/readme-status-refresh`, 2026-09-08).
- ✅ **PRODUCT.md owner-approved** (2026-09-06).
- ✅ **DESIGN.md** → `docs/DESIGN.md`. Tokens (slate base + blueprint-blue primary + geofence-amber
  accent), IBM Plex Sans + JetBrains Mono, component conventions, the geofence assertive treatment, and
  the per-page Mobile First/Ready table (2026-09-06).

- ✅ **Planning Assistant interview** → `docs/PRODUCT.md` written (12 required sections + conditional +
  Design Identity + Out of Scope). Interview produced D-17…D-23. Feature-boundary [WHAT] resolved.
  **Owner-approved** (2026-09-06).

- ✅ **R-3b file-sync re-comparison** → `docs/planning/R3b_FILE_SYNC_REVISED.md`. Corrected R-3's wrong
  claim that Syncthing has no access-control boundary (it does — server-side, `lib/model/model.go:1982`).
  Owner's hard per-user read-only requirement decided it: **Nextcloud** (D-10), since Syncthing has no
  per-device read-only. Own-build priced honestly at 4–7 months (2026-09-06).
- ✅ **R-5 document-AI feasibility** → `docs/planning/R5_DOCUMENT_AI.md`. **Qualified yes** — free,
  CPU-only, licence-clean, TypeScript-only, but DB-matching-first; LLM-first is not feasible on this
  hardware. L0+L2 carry ~55–80% with no LLM. Licence blockers found: Surya weights (OpenRAIL-M revenue
  cap), Gemma (gated + use restrictions), Llama (non-free terms). Clean lane: RapidOCR/Tesseract +
  Ollama + Qwen3-4B/Phi-4-mini. Thin slice 3–4 weeks, full v1 3–3.5 months (2026-09-06).

- ✅ **R-1 remote-access overlay survey** → `docs/planning/R1_REMOTE_ACCESS.md`. Pangolin CE (AGPL-3.0)
  reverse tunnel primary, plain Traefik + port-forward fallback. Cloudflare Tunnel disqualified on ToS
  (self-hosted large-file/video restrictions); Netmaker ruled out (paid CGNAT relay + `pro/` licence
  claims modification ownership) (2026-09-06).
- ✅ **R-2 NAS storage access (DH2300)** → `docs/planning/R2_NAS_STORAGE.md`. **No Docker, no S3 on this
  model** (verified per-model). MinIO runs on the Linux host over an NFS mount of a Btrfs RAID-1 share;
  no-NAS fallback is the identical code path on local disk (2026-09-06).
- ✅ **R-3 file-sync engine** → `docs/planning/R3_FILE_SYNC.md`. **Nextcloud** (Team folder per project),
  Seafile CE fallback; **Syncthing rejected** — no user model, would force us to hand-write the whole
  server-authoritative access-control layer. Overturns the seed brief's Syncthing prior (2026-09-06).
- ✅ **R-4 Kaneo teardown** → `docs/planning/R4_KANEO_TEARDOWN.md`. Verdict: shortens ~10% of the build
  (~600–900 liftable lines + ~2 weeks of UI/UX and schema decisions), **0% of what makes the product ours**
  — geofencing, clients, revisions, evidence photos, inventory are all net-new (2026-09-06).
- ✅ **Project seeded** — folder created, git initialised, seed brief + decisions + backlog written
  (2026-09-06).
