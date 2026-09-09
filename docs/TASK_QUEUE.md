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
- 🔴 **[BLOCKED-infra] Pangolin throughput test — BLOCKING before any customer install** — needs a live
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

- 🔴 **BullMQ `@valkey/valkey-glide` build warning** — since `apps/web` imports `@orqafy/jobs`, `next build`
  emits a benign "Module not found: @valkey/valkey-glide" warning (BullMQ's optional Glide client; we use the
  default ioredis path — runtime-verified working). Silence by marking it external in `next.config`.
  `<source: agent-found 2026-09-09>`
- 🔴 **`Document.size` Int→BigInt** if single files >2GB are expected (Prisma schema + Zod). Construction
  drawings are usually well under, so Int is fine for v1 — revisit if large-file uploads surface.
  `<source: agent-found 2026-09-08>`
- 🔴 **ESLint 8→9 flat-config migration** — Part 1 pinned ESLint 8.57.1 (EOL) to match the framework's
  legacy `.eslintrc` shape. Migrate to ESLint 9 flat config when convenient. `<source: agent-found 2026-09-08>`

### Remaining web scope (finish before mobile — web-first, D-25/W-1)

- ✅ **Entity forms — DONE** — Leave (apply/approve) · Milestones · Users (create/edit + role assign)
  (`feat/web-mgmt-forms` 583efad) · **Permission-builder editor UI (D-17)** (`feat/web-permission-builder`
  701d6b4) · **Document upload + metadata form** (`feat/web-document-management` 206c66d). All runtime-verified.
- 🔴 **Stubbed web features (remaining)** — Leaflet map picker for task location · live kanban drag-drop ·
  websocket transport for realtime (D-22) · self-hosted woff2 fonts. Each its own chunk, runtime-verify after
  each. `<source: agent-found 2026-09-08>`
- 🔴 **Document OCR/matching processors** — the `ocr` + `document-matching` BullMQ processors in
  `@orqafy/jobs` are still stubs (return pending). Upload enqueues a real OCR job (verified `bull:ocr`), but
  the processing (RapidOCR/Tesseract clean lane per R-5/D-13, then the DocumentReview match tray) is a later
  chunk. `<source: agent-found 2026-09-09>`
- 🔴 **Expo mobile (Part 6) + Tauri desktop** — later waves (own sessions): offline-first, on-device geofence
  (D-19/R6), photo capture; Tauri client + Rust sync sidecar (D-11/D-14). `<source: plan 2026-09-08>`

## ✅ Done recently

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
