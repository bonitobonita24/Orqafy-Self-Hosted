# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-09 · **WEB CORE v1 COMPLETE + verified. Phase 4 Parts 1–5, 7, 8 + web usable-forms + Leave/Milestones/Users mgmt forms + dashboard/pgbouncer bugfix + permission-builder editor UI (D-17) + document upload/management + Leaflet map picker + live kanban drag-drop + realtime board updates over SSE (D-22).** Current tip `feat/mobile-scaffold` (`3d2d78e`, off `fix/prod-build-clean` `1ed4e07`). **Expo mobile wave IN PROGRESS — chunks 1 (scaffold) + 2 (offline data layer) + 3a (auth server-side) ✅ DONE + verified** (chunk 3a LIVE-verified: mobile bearer-token path in `apps/web`, jose HS256 alg-pinned, per-request isActive re-check, `createOrqafyClient` superjson; 7 unit + 5 live tests, cookie path preserved). **Chunk 3b (mobile-side auth client) in progress.** See `docs/tasks/mobile-wave-plan.md`. ✅ **Review-tray UI (`/review`) + OCR-text document search (`/files`) DONE + live-verified (Playwright+DB+tRPC logs)** — the last remaining web feature scope. ✅ **Production `next build` is now GREEN (2026-09-09)** — the previously-HIGH `<Html>`/404 static-gen blocker **no longer reproduces** (cleared incidentally by the `b59b086` ocr.ts fix; two clean builds exit 0, 6/6 static incl. `/_not-found`), and the benign BullMQ `@valkey/valkey-glide` warning is silenced via a `next.config.mjs` webpack IgnorePlugin. **NEXT = finish Expo mobile wave chunk 3b (mobile-side: SecureStore token + authed client + login flow + outbox send seam — in progress) — then chunk 4 (geofence integration: expo-location/expo-task-manager module-scope task wired to `@orqafy/geofence`) / chunk 5 (core screens); authority = `docs/tasks/mobile-wave-plan.md`. Tauri desktop is a later separate wave.** ✅ **Document OCR + doc-matching pipeline DONE + verified** (2026-09-09): real `@orqafy/jobs` `ocr`/`document-matching` processors → offline RapidOCR sidecar (Docker profile `ocr`) → `Document.ocrText`/auto-file/DocumentReview match tray; deterministic exact-ID matcher (no LLM, D-13); 15 unit tests; live e2e from the committed containers. ✅ self-hosted woff2 fonts done. D-22 realized as tRPC v11 SSE (not WS) — see DECISIONS_LOG; multi-instance Valkey-pub/sub backing is a POST-V1 scale seam. ✅ **Dev Docker rebuild FIXED** (added repo `.dockerignore` + `CI=true` — also unblocks `Dockerfile.app`); the dockerized `worker`+`ocr` containers now build + run (host hot-reload path still available: `pnpm --filter @orqafy/web dev` on 56483 against dockerized infra). Monorepo: 8 `@orqafy/*` packages + `apps/web` (Next.js+tRPC+Auth.js, plain shadcn/Kibo) + dev Compose bundle; framework brain LOCAL-ONLY (gitignored + guard-verified). **Live runtime-verified**: first-run→login→dashboard(KPIs)→Client/Project/Task created+edited via FORM UIs, persisted (Playwright+DB). LICENSE (AGPL-3.0) + README (honest status + quickstart) + `.github/workflows/ci.yml` (lint/typecheck/test/build, no publish) added. web+jobs typecheck + web/jobs lint green; ✅ **`next build` now completes clean (exit 0, 6/6 static pages) — the `<Html>`/404 blocker is resolved and the valkey-glide warning silenced** (only remaining warning is the benign `jose`/Edge `CompressionStream` note); AGPL boundary verified after every step; **HARD HOLD — nothing pushed**.

**Phase 4 Part 7 ✅ (branch `feat/phase4-part7`, local, HARD HOLD).** Dev Compose bundle `deploy/compose/dev/` (postgres+pgbouncer, valkey, minio+console+bucket-init, mailhog, pgadmin pre-wired, app, worker) + `start.sh` + `tools/dev-smoke.sh`; Rule-22 ports, named volumes `orqafy_dev_*`, NO `docker-publish.yml` (D-3/D-27). `docker compose config` valid. **Live-verified end-to-end**: migration applied (16 tables), web app booted, Playwright drove first-run→login→dashboard→Client/Project/Task CRUD, all persisted (UI reload + DB). Added worker entrypoint `packages/jobs/src/main.ts`. **Fixed a blocking Part-5 middleware bug** (`/api/trpc` was 307→/login for unauth'd requests, killing first-run) — see SESSION_LOG + lesson `nextjs.middleware.matcher-gates-api-trpc`. Agent-found open item: `/` on fresh install redirects to `/login` not `/setup` (TASK_QUEUE). Part 6 (Expo mobile) is a later wave (web-first, D-25/W-1).

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **WEB CORE v1 ✅ COMPLETE + verified + documented** — Phase 4 Parts 1–5, 7, 8 + Client/Project/Task
   create-edit forms + `/setup` fix + dashboard/pgbouncer bugfix. 8 `@orqafy/*` packages + `apps/web` + dev
   Compose + LICENSE/README/CI. Live-verified (first-run→login→dashboard→form-CRUD, Playwright+DB). Current
   tip `feat/phase4-part8-docs`. Framework brain LOCAL-ONLY (gitignored + guard-verified). **NEXT = remaining
   web scope** (§Next un-gated work), then Expo mobile + Tauri desktop (later waves).
3. **`docs/PRODUCT.md` APPROVED; mockup APPROVED (2026-09-08)** — design gate cleared. `docs/DESIGN.md`
   (+ §8 offline-first, §9 desktop packaging) + `docs/MOCKUP.jsx`.
4. **Open `[WHAT]`s** in `PENDING_DECISIONS.md`: **0**. **27 decisions locked (D-1…D-27).** FULL AUTO MODE
   engaged 2026-09-08 (no approval questions; defer `[WHAT]`; HARD HOLD stays hard).
5. **Backlog:** `docs/TASK_QUEUE.md` — open items are build/verify tasks (public-repo asset guard +
   the queued verification tasks: geofence-over-tunnel, headless-sync, Pangolin throughput,
   offline-first mobile, sync resource-cost, Expo background-geofence). Interview + R-1…R-5 are ✅.

## Where things stand

- **Phase 0 scaffold + Phase 4 Parts 1–4 complete + verified.** Monorepo with 8 `@orqafy/*` packages
  (shared · api-client · db · ui · storage · jobs · sync · geofence): root config, Prisma schema +
  migration + seed (no tenant_id, R-4 seed override), runtime packages — all typecheck/lint/test green.
  Plus **`apps/web` (Part 5) built + `dev Compose` (Part 7) live runtime-verified** end-to-end.
- **No remote — local only, HARD HOLD** (nothing pushed/deployed). Feature-branch chain off `main`
  (main = init only); current tip `feat/phase4-part7`.
- Framework files (`.ai_prompt/`, `AI/`, AdminCN slice) seeded **LOCAL-ONLY**, gitignored +
  asset-guard-enforced — this AGPL-public repo carries NO framework IP / paid slice (independently
  verified after every Part).

## Decisions already locked (do not reopen without the owner)

D-1 AIEF locked stack, Kaneo as reference only · D-2 AGPL-3.0 public · D-3 Docker Compose first,
native installer later · D-4 phased v1 (PM + files + geofence + mobile), v2 (invoicing/PO/inventory/
expenses) · **D-5 single-company install — no tenant model, no `tenant_id`** · **D-6 mobile is
sideload/self-build only — no store listing**. D-1…D-4 rationale: `docs/SEED_BRIEF.md` §2.
D-5 + D-6 rationale and full consequences: `docs/DECISIONS_LOG.md`.

## Hard constraints carried forward

- **Geofencing is native-only** — Expo app required; iOS PWAs have no background location.
- **Public repo ⇒ no framework files, no AdminCN slice, ever.**
- **No Powerbyte credentials, ever** (D-5) — third parties install this; first-run setup creates the
  operator's own admin account. The fleet universal-login credentials do **not** apply here.
- **iOS mobile has no free sideload path** (D-6) — TestFlight or the user's own Apple dev account.
  State it plainly in the README rather than implying Android/iOS parity.
- **HARD HOLD** — local only; no staging/prod/deploy without the owner's explicit word.

## Next un-gated work

1. ~~Mockup~~ ~~Phase 0~~ ~~Parts 1–5,7,8~~ ~~web create/edit forms~~ ~~/setup fix~~ ~~dashboard+pgbouncer bugfix~~ ~~LICENSE/README/CI~~ ✅ **DONE 2026-09-08 (full-auto).**
2. **NEXT → remaining web scope** (finish web-first before mobile). Leave/Milestones/Users forms ✅
   (`feat/web-mgmt-forms` 583efad). **Permission-builder editor UI (D-17) ✅** (`feat/web-permission-builder`
   701d6b4). **Document upload/management ✅** (`feat/web-document-management` 206c66d). **Leaflet map picker ✅**
   (`feat/web-map-picker` 93008dc, runtime-verified). **Live kanban drag-drop ✅** (`feat/web-kanban-dnd`
   c43ed89, runtime-verified). Remaining: **websocket transport** for realtime (D-22) · **self-hosted woff2
   fonts**. Then **Document OCR/matching processors** (`@orqafy/jobs` stubs). Each its own chunk; runtime-verify
   after each.
3. **Part 6 (Expo mobile) + desktop (Tauri)** are later waves (web-first, D-25/W-1) — big enough for their own
   sessions. Stubs still open in web: WS transport, self-hosted woff2 fonts, document OCR/matching processors.
4. **Deferred `[HOW]` follow-ups (TASK_QUEUE):** `Document.size` Int→BigInt if >2GB · ESLint 8→9 flat config.
   Plus the 3 BLOCKED (hardware/stack/tunnel) + POST-V1 cloud-storage.

## Session note — 2026-09-09 (Expo mobile wave chunk 2 — offline data layer — `feat/mobile-scaffold`)

Owner said continue → built chunk 2 (offline-first data layer, DESIGN §8) via one TDD Opus worker; PM-verified
against ground truth. **Pure, device-independent domain logic** (29 vitest green) split from a typecheck-only
`expo-sqlite` adapter: `outbox.ts` (append-only ordered queue, idempotent enqueue by client-supplied UUID =
server dedupe key, status/attempts transitions) · `reconcile.ts` (record-level LWW by `updatedAt` + soft-conflict
flag when server wins over a pending local edit + tombstone resurrection-suppression + fullSync server-delete) ·
`sync-engine.ts` (deterministic `drainOutbox` with an **injected `send` seam** — real tRPC client deferred to
chunk 3, keeping this chunk independent of the auth gap) · `sqlite/` stores over SDK-54 async API. **Verified
green independently:** vitest 29/29, tsc exit 0, eslint exit 0, pure files have zero native imports, no forbidden
server imports. **Design note:** DESIGN §8 says LWW "per field" but shared records carry one `updatedAt` — no
per-field timestamps — so implemented record-level LWW (logged as a traceable simplification). One commit
`1abc877` (amended once to fix a zsh backtick-in-`-m` message mangle — lesson logged). HARD HOLD local.
**NEXT = chunk 3 (auth + tRPC transport).**

## Session note — 2026-09-09 (Expo mobile wave STARTED, chunk 1 scaffold — `feat/mobile-scaffold`)

Owner promoted the mobile wave ("start the Expo mobile wave"). PM flow: scout-mapped the settled mobile
spec + integration contract, verified Expo config-plugin/permission wiring + monorepo Metro via context7,
wrote the durable wave plan (`docs/tasks/mobile-wave-plan.md` — 5 chunks, static+unit done-bar since there's
NO device here), then dispatched one Opus worker to hand-author `apps/mobile`. **Chunk 1 ✅ done + PM-verified
against ground truth** (not the worker's self-report): `apps/mobile` Expo SDK 54 (`expo install`-pinned:
expo ~54.0.37 / expo-location ~19.0.8 / expo-task-manager ~14.0.9 / react-native 0.81.5), `app.json` config
plugins wiring background-geofence permissions (iOS Always + UIBackgroundModes; Android ACCESS_BACKGROUND +
FOREGROUND_SERVICE_LOCATION), monorepo `metro.config.js`, strict-base tsconfig, ESLint v8 cjs, expo-router
bottom-tab shell + themed placeholders, RN theme adapter over `@orqafy/ui/theme` token VALUES. **Verified
green independently:** `tsc --noEmit` exit 0, `eslint` exit 0, `expo config` resolves + plugins parse, zero
forbidden server-package imports, asset guard clean. One commit `dc138a4`, HARD HOLD local. **Two [HOW] gaps
recorded for chunk 3** (no server bearer-token path yet — web is Auth.js cookie/JWT; `createOrqafyClient`
lacks superjson + subscription link). **Cross-scope:** `apps/mobile` now depends on `@orqafy/ui` (workspace:*)
for the pure /theme values only — follow-up logged to enforce Rule 13 via eslint `no-restricted-imports`.
**NEXT = chunk 2 (offline data layer).**

## Session note — 2026-09-09 (prod-build unblock — `fix/prod-build-clean`)

Resume session. Reconciled cold-start authority vs ground truth (clean tree, 0 open `[WHAT]`, tip
`feat/document-review-search` `28355dd`). Owner: "resume the web-first build." Top un-gated web item was the
HIGH `<Html>`/404 production-build blocker — worked it under systematic-debugging (reproduce before fixing).
**Surprise/RINGER:** it does NOT reproduce. Two clean `rm -rf .next && pnpm --filter @orqafy/web build` runs
each exit 0, generate all 6 static pages (incl. `/_not-found` as static ○), zero `<Html>` errors. Root cause
of the *original* failure: the pre-`b59b086` ocr.ts `Blob([Uint8Array])` BlobPart issue distorted the
server module graph feeding the `/_error` chunk (compounded by a stale `.next`) — the ocr.ts fix already
cleared it; no code change was needed for the 404. **Lesson worth carrying:** a build failure logged HIGH
was fixed as a side-effect of an unrelated typecheck fix — always re-reproduce a stale blocker before
investing in it (verify-vs-ground-truth). Then closed the *next* build 🔴: silenced the benign BullMQ
`@valkey/valkey-glide` warning with a webpack `IgnorePlugin` in `apps/web/next.config.mjs` (ioredis path
only; glide never taken) — verified gone, build exit 0, `/api/trpc`→jobs→bullmq route still bundles. Logged
one remaining benign warning (`jose`/Edge `CompressionStream`, Auth.js, no runtime effect) as 🟡 do-not-chase.
One commit `64f4806`, asset guard clean, HARD HOLD local. **NEXT = Expo mobile (Part 6) + Tauri desktop
(own sessions).** RBAC-retrofit SessionStart flag re-declined (D-5 single-org).

## Session note — 2026-09-09 (Live kanban drag-drop — `feat/web-kanban-dnd`)

Worked the top remaining web-scope stub: **live kanban drag-drop** on the project board (branch
`feat/web-kanban-dnd` off `feat/web-map-picker`). Replaced the hand-rolled stub in
`packages/ui/src/components/kibo/kanban.tsx` with a real `@dnd-kit/core@^6.3.1` board — `DndContext`,
`useDroppable` columns keyed to the four `TaskStatus` values, `useDraggable` cards, Pointer (6px activation)
+ Keyboard sensors; `onCardMove(cardId, toColumnId)` fires only on a cross-column drop. Kept the existing
themed column/card look (subtle grabbing-cursor + dragged-opacity + hovered-column ring only). Wired
`apps/web/src/app/(app)/projects/[id]/page.tsx`: `trpc.tasks.move` mutation with react-query v5 optimistic
update (onMutate cancels + snapshots + `setData` to move the card, onError rolls back, onSettled invalidates
`projects.byId`). Column ids === `TaskStatus` values, so no mapping. Static gates green (ui/web typecheck,
web lint, web build). **PM runtime-verified via Playwright on the live dev stack** (`admin@orqafy.local`,
Harbourview project): note the well-known dnd-kit+Playwright `dragTo` limitation — the MCP `browser_drag`
(HTML5-style) always resolved collision to the source column; a **stepped `page.mouse` pointer drag** (down →
25 interpolated moves → up) worked, dnd-kit announced "dropped over droppable area blocked", the board moved
the card optimistically (To-do 1→0, Blocked 0→1), `tasks.move` persisted `status=blocked` to Postgres (psql
confirmed), and the move **survived a full page reload**. Reverted the test fixture (task back to `todo`).
One commit `c43ed89`, AGPL guard clean (pre-commit hook), HARD HOLD local. **Two infra footguns found +
logged to TASK_QUEUE (not fixed — out of scope):** dev Docker rebuild fails on pnpm-purge-no-TTY; no
`.dockerignore` sends host node_modules into the build context. Verification used the host hot-reload dev
path (the supported path — `.env.dev` is already host-shaped).

## Session note — 2026-09-09 (Leaflet map picker — `feat/web-map-picker`)

Worked the top remaining web-scope item: **Leaflet map picker for task geofence location** (branch
`feat/web-map-picker` off `feat/web-document-management`). Delivered a new `MapPicker` in `@orqafy/ui`
(click-to-place + draggable marker + `Circle` radius preview, inline-SVG `divIcon` so no CDN marker asset,
env-configurable tile URL `NEXT_PUBLIC_MAP_TILE_URL` default OSM), exposed via the `@orqafy/ui/map-picker`
**subpath** export (NOT the barrel — keeps leaflet from evaluating server-side, which had caused a `/setup`
SSR `window is not defined` crash); `apps/web` wraps it in a `next/dynamic` `ssr:false` client component and
integrates it into `task-form.tsx` (map writes `geofenceLat/Lng` at 6dp via `setValue`, radius input drives the
circle, numeric inputs retained). Added `parseGeofenceStrings` + 8 vitest in `@orqafy/shared`. Static gates green
(typecheck 9/9, lint 9/9, web build, new tests 8/8 · geofence 12/12 · storage 10/10). **PM runtime-verified via
Playwright on the live dev stack** (`admin@orqafy.local`): New-task map rendered, 6/6 OSM tiles loaded, click set
lat 14.600066 / lng 120.984192, radius 150 drove the circle, created task persisted `{"lat":14.600066,"lng":120.984192,"radiusMeters":150}`
to the DB (confirmed via psql); only a benign favicon 404 in console. Deps added: `@orqafy/ui` leaflet@^1.9.4 +
react-leaflet@^5.0.0 + @types/leaflet (dev); `@orqafy/shared` vitest (dev). One commit `93008dc`, AGPL guard clean,
HARD HOLD local. **NEXT = remaining web scope** (live kanban DnD · WS transport D-22 · self-hosted woff2 fonts),
then Document OCR/matching processors. SessionStart RBAC-retrofit flag re-declined — false positive, D-5 single-org.

## Session note — 2026-09-09 (loop slot 12 — document upload/management)

Loop wake, empty handoff. Re-derived the queue (0 open `[WHAT]`, clean tree, un-gated work available) → worked
the top item: **Document upload + management** (branch `feat/web-document-management` off
`feat/web-permission-builder`; scout-mapped the module, then two serial Opus workers: backend/transport, then
frontend). **[HOW] decided: server-proxied `/api/media` upload** (StorageAdapter streams server-side; no
browser-direct presigned PUT — local-disk can't presign + avoids the MinIO signed-host mismatch; LAN-first
D-15). Delivered: `/api/media` POST (manage_files-gated, 50MiB cap, exec/script denylist) + `/api/media/[id]`
GET (auth + isSPI/view_finances gated) download proxy; documents `create`(+best-effort OCR enqueue)/`update`/
`delete`(+best-effort object delete); `buildDocumentKey` traversal-safe helper (+10 vitest); env→storage-config
mapper + BullMQ queue singletons; Files-page upload dialog + per-row download/edit/delete + Restricted badge.
**PM runtime-verified via Playwright on the live dev stack** (infra in Docker + web on host, `.env.dev` sourced):
upload→object in MinIO at the safe key + `bull:ocr` job enqueued + DB row; download returned the real 85 bytes;
metadata edit (project preserved); delete cascaded row+object; console clean (only pre-existing favicon 404).
**Caught + fixed a data-loss defect in verification:** the edit dialog's project/client `<select>`s load async,
so RHF applied the saved id before its `<option>` existed → value fell back to "None" → saving would silently
unset the filing. Fixed with a re-sync `useEffect` once the option lists resolve; lesson logged
(`react-hook-form.async-select.prefill-data-loss`). One commit `206c66d`, asset guard clean, HARD HOLD local.
Cross-scope note: `apps/web` now depends on `@orqafy/storage`+`@orqafy/jobs` and talks to MinIO+Valkey via the
`/api/media` proxy + `getQueues()`. **NEXT = remaining web scope** (Leaflet map picker · kanban DnD · WS · fonts).
RBAC-retrofit SessionStart note re-declined (superseded by D-5).

## Session note — 2026-09-09 (loop slot 11 — permission-builder editor UI, D-17)

Loop wake. Re-derived the queue per ⚠RESCAN: 0 open `[WHAT]`, clean tree, un-gated work available → worked
the top item. Built the **D-17 permission-builder editor UI** (branch `feat/web-permission-builder` off
`feat/web-mgmt-forms`; scout-mapped the RBAC API + form idiom, then dispatched one Opus worker). Backend API
already existed — front end only. Delivered: dependency-free `Checkbox` in `@orqafy/ui`; `/settings/roles`
group builder (create/edit/delete custom groups, edit system-group permissions with name locked); per-user
overrides dialog on the Users table (3-state override over the role+group base); shared permission labels.
**PM runtime-verified via Playwright on the live dev stack** (infra in Docker + web on host): created a custom
group (persisted), confirmed system-group name-lock, set+persisted a per-user override across a full reload,
cleared it, deleted the custom group. typecheck/lint/`@orqafy/web build` green; only console error is a
pre-existing favicon 404. One commit `701d6b4`, pre-commit asset guard clean. HARD HOLD — nothing pushed.
**NEXT = Document upload/management.** RBAC-retrofit SessionStart note re-declined (superseded by D-5).

## Session note — 2026-09-09 (resume + save, slot 11 — no code change)

Reconcile-only session. Loaded cold-start authority, reconciled vs ground truth: clean tree, branch
`feat/web-mgmt-forms` tip `b614da5`, **0 open `[WHAT]`**. Corrected the stale tip references in STATE.md
header + cold-start memory (was `feat/phase4-part8-docs` → now `feat/web-mgmt-forms`) and re-derived NEXT
from the queue = **permission-builder editor UI (D-17)**. Re-flagged and re-declined the SessionStart
3-tier RBAC retrofit — superseded by D-5 (single-company, no tenant model). Owner asked to save + hand off;
no build work performed. HARD HOLD held (nothing pushed).

## Session note — 2026-09-08 (Phase 0 scaffold — branch `chore/phase0-scaffold`)

Executed Phase 0 tasks P0.1→P0.6 (stopped at the exit gate; did NOT run Phase-4 B1-B8). Six atomic
local commits on `chore/phase0-scaffold` (off `docs/research-integration`), HARD HOLD — no push.
P0.1 extended the AGPL asset guard for framework tooling (19/19 fixtures blocked); P0.2 seeded
`.ai_prompt/` + ran `deploy.sh` (all framework IP gitignored+guarded; closed a missed
`scripts/audit-scope.mjs` gap); P0.3 authored `inputs.yml` + `inputs.schema.json` (validates);
P0.4 non-destructive bootstrap scaffold (approved docs untouched — `git diff` empty); P0.5 Rule-22
dev ports (base 56473) + `.env.dev`/`.env.example`; P0.6 exit gate. CREDENTIALS.md is dev-only,
generated secrets, NO Powerbyte creds (D-5). `check-public-assets.sh --tracked` green throughout.

## Session note — 2026-09-08 (loop iteration, slot 11)

Loop wake with an empty handoff. Reconciled vs ground truth (clean, 0 open `[WHAT]`). Worked the
highest-priority un-gated task: **wired the public-repo asset guard enforcement** (pre-commit/pre-push
hooks refuse framework IP / AdminCN slice; verified by a refused force-add). Also corrected the stale
README stage. Two local commits (`chore/asset-guard` 99feae9, `docs/readme-status-refresh` 8a00746);
HARD HOLD, no push. Remaining 🔴s are phase-deferred verification (devices / running stack / near-phase).
The **owner mockup confirm** remains the gate before Phase 0. RBAC retrofit stays **declined** (D-5).

## Session note — 2026-09-08 (earlier, slot 12)

Resumed loop session (slot 12). Reconciled state vs ground truth: 0 open `[WHAT]`, clean tree. Owner
chose "confirm the mockup" → rendered Dashboard PNG delivered via SendUserFile. Owner then requested
save + stop the loop **before** giving an explicit mockup confirm — so the mockup confirm remains the
open gate. Flagged (and declined pending owner word) the SessionStart RBAC-retrofit
suggestion: **superseded by D-5** (single-company install, no tenant model — fleet 3-tier RBAC does not
apply here).

## Session note — 2026-09-08 (Phase 4 Part 4 — branch `feat/phase4-part4`)

Built the shared runtime packages off `feat/phase4-part3`. Five new typed, testable workspace
packages behind clean interfaces; feature internals stubbed with explicit TODOs, signatures + wiring
complete and typecheck-green:

- **`@orqafy/ui`** — MIT shadcn/ui + Kibo UI layer themed to DESIGN.md tokens (slate + blueprint-blue +
  geofence-amber; IBM Plex Sans + JetBrains Mono). Base primitives (button/card/input/label/dialog/
  table/form) + Kibo wrappers (kanban/gantt/dropzone stubs) + tokens/theme module + Tailwind preset +
  globals.css. **No AdminCN / shadcn-studio Pro paid components (D-26).**
- **`@orqafy/storage`** — one `StorageAdapter` interface, config-selected `S3StorageAdapter`
  (MinIO/S3/R2, incl. NFS-mounted MinIO — R-2/D-27) **and** `LocalDiskStorageAdapter` fallback;
  presigned up/down URLs; path-traversal-guarded.
- **`@orqafy/jobs`** — BullMQ (Valkey) queues + typed job defs (OCR, doc-matching, sync-orchestration,
  notification-dispatch, scheduled-reminders, progress-rollup) + real worker bootstrap, stub processors.
- **`@orqafy/sync`** — `FileSyncProvider` port + `NextcloudCmdDriver` (R8 approach a; argv builder real,
  spawn/supervision = Part 7 Tauri sidecar) + `WebDavSyncDriver` fallback seam (D-10a b).
- **`@orqafy/geofence`** — pure on-device logic (D-19/R6): region model, haversine inside/outside eval,
  iOS 20-region prioritisation, app-side dwell state machine. 12 vitest tests pass.

Verify: `pnpm install`; `pnpm typecheck` + `pnpm lint` green across all 8 packages; `prettier --check`
clean; `pnpm test` → geofence 12/12. Layering respected (ui/storage/jobs/geofence → only `@orqafy/shared`;
no `apps/*` imports). Asset guard `--staged` + `--tracked` clean; `git ls-files` shows NO framework IP /
AdminCN slice. One commit (`98a0505`), HARD HOLD — LOCAL only, no push/PR/merge. **Next → Phase 4 Part 5.**

## Session note — 2026-09-09 (self-hosted fonts — branch `feat/self-hosted-fonts`)

Vendored the two brand faces as latin-subset OFL woff2 and wired self-hosting so the app makes NO external
font request at build or runtime (D-3 offline-first; no Google Fonts in the AGPL public repo).

- **Fonts:** `apps/web/src/fonts/{ibm-plex-sans,jetbrains-mono}-latin-{400,500,600}-normal.woff2` (weights
  scoped to what the UI renders — `font-medium`=500, `font-semibold`=600, body=400; no 700). OFL 1.1 license
  text vendored beside them (`LICENSE-*.txt`) + a `README.md`.
- **Loader:** `apps/web/src/lib/fonts.ts` — `next/font/local` `fontSans`/`fontMono`, `display:swap`, system
  fallbacks, exposed as `--font-plex-sans` / `--font-jetbrains-mono`; classes applied to `<html>` in
  `layout.tsx`.
- **Cross-scope:** shared `packages/ui/src/theme/globals.css` (@orqafy/ui, consumed only by apps/web) now
  reads `--font-sans`/`--font-mono` via the var() FALLBACK form (`var(--font-plex-sans, 'IBM Plex Sans',
  …)`) — a bare undefined var() would invalidate the whole declaration, so the literal+system fallback lives
  inside var() for any consumer that hasn't wired next/font.

Verify: `pnpm --filter @orqafy/web typecheck` + `lint` + `build` all green. Production `next start` + isolated
Playwright: all 6 faces served from `/_next/static/media/*.woff2` (200); ZERO requests to fonts.googleapis /
fonts.gstatic / jsdelivr; `--font-sans` resolves fontSans-first with IBM Plex Sans 400/500/600 `loaded`;
`--font-mono` resolves fontMono; login renders in Plex (screenshot `screenshots/login-fonts-check.png`).
One commit (`0560001`), asset guard clean, HARD HOLD — LOCAL only. **Next → Document OCR/matching processors
(`@orqafy/jobs` stubs).**
