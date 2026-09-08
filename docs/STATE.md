# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-08 · **Phase 4 Parts 1–5 + Part 7 done; next: Phase 4 Part 6 (Expo mobile) / Part 8 (manifest/docs).** Monorepo config seeded (inputs.yml, .nvmrc, package.json, dev ports/env, CREDENTIALS.md dev seed); framework brain seeded LOCAL-ONLY (gitignored + asset-guard verified). Spec approved; `docs/DESIGN.md` + `docs/MOCKUP.jsx` done. Packages `@orqafy/{shared,api-client,db,ui,storage,jobs,sync,geofence}` + `apps/web` built, typecheck/lint green.

**Phase 4 Part 7 ✅ (branch `feat/phase4-part7`, local, HARD HOLD).** Dev Compose bundle `deploy/compose/dev/` (postgres+pgbouncer, valkey, minio+console+bucket-init, mailhog, pgadmin pre-wired, app, worker) + `start.sh` + `tools/dev-smoke.sh`; Rule-22 ports, named volumes `orqafy_dev_*`, NO `docker-publish.yml` (D-3/D-27). `docker compose config` valid. **Live-verified end-to-end**: migration applied (16 tables), web app booted, Playwright drove first-run→login→dashboard→Client/Project/Task CRUD, all persisted (UI reload + DB). Added worker entrypoint `packages/jobs/src/main.ts`. **Fixed a blocking Part-5 middleware bug** (`/api/trpc` was 307→/login for unauth'd requests, killing first-run) — see SESSION_LOG + lesson `nextjs.middleware.matcher-gates-api-trpc`. Agent-found open item: `/` on fresh install redirects to `/login` not `/setup` (TASK_QUEUE). Part 6 (Expo mobile) is a later wave (web-first, D-25/W-1).

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **Phase 0 ✅ + Phase 4 Parts 1–4 ✅ done. NEXT = Phase 4 Part 5 (`apps/web`).** Monorepo built:
   `@orqafy/{shared,api-client,db,ui,storage,jobs,sync,geofence}` scaffolded, typecheck/lint/test green.
   Framework brain seeded LOCAL-ONLY (gitignored + asset-guard verified).
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
  Next runnable milestone = Part 5 (`apps/web` boots).
- **No remote — local only, HARD HOLD** (nothing pushed/deployed). Feature-branch chain off `main`
  (main = init only); current tip `feat/phase4-part4`.
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

1. ~~Mockup confirm~~ ~~Phase 0~~ ~~asset guard~~ ~~Phase 4 Parts 1–4~~ ✅ **DONE 2026-09-08.**
2. **NEXT → Phase 4 Part 5 (`apps/web`):** Next.js + tRPC + Auth.js v5, plain shadcn/Kibo (D-26),
   dashboard per D-22. Swap api-client's placeholder `AppRouter` → the real server `AppRouter` type.
   Runtime verify needs dev Postgres up (bring it up; the Part-3 migration is apply-pending).
3. Then **Part 6** (Expo mobile), **Part 7** (dev Docker Compose — brings the stack up), **Part 8**
   (manifest/docs — **NO** `docker-publish`, D-27/inputs). Mobile+desktop are later waves (web-first, D-25/W-1).
4. **Deferred `[HOW]` follow-ups:** DB migration apply (Part 7 compose) · `Document.size` Int→BigInt if
   >2GB files · ESLint 8→9 flat config. Plus the 3 BLOCKED (hardware/stack/tunnel) + POST-V1 cloud-storage
   in `docs/TASK_QUEUE.md`.

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
