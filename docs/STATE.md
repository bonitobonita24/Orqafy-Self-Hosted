# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-09 · **WEB CORE v1 COMPLETE + verified. Phase 4 Parts 1–5, 7, 8 + web usable-forms + Leave/Milestones/Users mgmt forms + dashboard/pgbouncer bugfix + permission-builder editor UI (D-17).** Current tip `feat/web-permission-builder` (`701d6b4`, off `feat/web-mgmt-forms`). **NEXT = Document upload/management** (core module, stubbed: `@orqafy/storage`+`jobs` wiring + Document metadata form) — then remaining web scope (Leaflet map picker · live kanban DnD · WS transport · self-hosted woff2 fonts), then Expo mobile (Part 6) + Tauri desktop as later waves. Monorepo: 8 `@orqafy/*` packages + `apps/web` (Next.js+tRPC+Auth.js, plain shadcn/Kibo) + dev Compose bundle; framework brain LOCAL-ONLY (gitignored + guard-verified). **Live runtime-verified**: first-run→login→dashboard(KPIs)→Client/Project/Task created+edited via FORM UIs, persisted (Playwright+DB). LICENSE (AGPL-3.0) + README (honest status + quickstart) + `.github/workflows/ci.yml` (lint/typecheck/test/build, no publish) added. All typecheck/lint/build green; AGPL boundary verified after every step; **HARD HOLD — nothing pushed**.

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
   701d6b4, runtime-verified). Remaining: **Document upload/management** (core module, stubbed — wire
   `@orqafy/storage`+`jobs` + a Document metadata form) · **Leaflet map picker** (task geofence location) ·
   **live kanban drag-drop** · **websocket transport** for realtime (D-22) · **self-hosted woff2 fonts**.
   Each its own chunk; runtime-verify after each.
3. **Part 6 (Expo mobile) + desktop (Tauri)** are later waves (web-first, D-25/W-1) — big enough for their own
   sessions. Stubs still open in web: permission-builder editor, Leaflet map picker, document upload/OCR wiring,
   live kanban drag-drop, WS transport, self-hosted woff2 fonts.
4. **Deferred `[HOW]` follow-ups (TASK_QUEUE):** `Document.size` Int→BigInt if >2GB · ESLint 8→9 flat config.
   Plus the 3 BLOCKED (hardware/stack/tunnel) + POST-V1 cloud-storage.

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
