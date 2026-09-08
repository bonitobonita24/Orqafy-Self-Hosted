# Phase 0 — Bootstrap / Scaffold Execution Plan — Orqafy-Self-Hosted

**Status:** PLAN ONLY (owner approval gate before any execution). **HARD HOLD — local only, no remote,
no deploy, no framework files committed.** Authored by the Architect, 2026-09-08.

**Grounding (every "framework does X" claim is cited to a file+line):**
- Framework: `Powerbyte-AIEF/specdrivenprompt/bootstrap.md` (Phase 0, 20 steps),
  `deploy.sh` (seed/arrange script), `phases.md` (Phase 3 inputs.yml + Phase 4 8-part build + compose
  service specs), `starter/admincn/` (paid slice).
- App spec: `docs/SEED_BRIEF.md`, `docs/PRODUCT.md` (approved), `docs/DESIGN.md`,
  `docs/DECISIONS_LOG.md` (D-1…D-24), `docs/TASK_QUEUE.md`.
- Boundary: `scripts/check-public-assets.sh`, `.gitignore`.

**The one thing that makes this app's Phase 0 non-standard:** the spec phases are already DONE
(`docs/PRODUCT.md` approved, `DESIGN.md`, `DECISIONS_LOG` D-1…D-24, mockup approved D-24). The repo has
`docs/`, git, `.gitignore`, and the asset guard — but **no `.ai_prompt/`, no `CLAUDE.md`, no `inputs.yml`,
no `package.json`, no `apps/`/`packages/`** (verified: all absent). So Phase 0 here is a **non-destructive,
spec-pre-loaded bootstrap** — seed the framework locally, author `inputs.yml` from the existing decisions,
run only the bootstrap steps that create MISSING scaffolding, and never clobber the approved docs.

---

## 1. Exact bootstrap path

**Phase 0 = the framework `bootstrap.md` 20-step routine, NOT `deploy.sh` alone.** They are two
different tools that run in sequence:

- **`deploy.sh` = SEED + ARRANGE.** It validates that `.ai_prompt/` exists in the project
  (`deploy.sh:266-273` — errors out if absent), overwrites project-root `CLAUDE.md` from
  `.ai_prompt/CLAUDE_compact.md` (`deploy.sh:505`, backup-before-overwrite at `:395`), copies the 7
  load-on-demand detail files into `.ai_prompt/` (`deploy.sh:509-511` + the deliverable list at
  `:38-241`), installs framework scripts, and **append-only** manages `.gitignore`
  (`append_line_if_missing`, `deploy.sh:415-500` — it only ADDS missing lines, never removes the app's
  existing ignore rules). deploy.sh copies FROM the project's own `.ai_prompt/`, so the raw framework
  files must be placed there first.
- **`bootstrap.md` Steps 1-20 = SCAFFOLD.** Trigger is "open Claude Code in the folder → paste the
  master prompt → type `Bootstrap`" (`bootstrap.md:10`). Claude Code then runs 20 automatic steps:
  folder structure (Step 1), `CLAUDE.md` (Step 2), `.clinerules` tombstone (Step 3), `docs/tasks/`
  8 Phase-4 task files (Step 4), `docs/memory/` (Steps 5-6), `.claude/settings.json` + design Stop hook
  (Step 7), `.gitignore`/`.nvmrc`/`package.json` (Step 8), WSL2 mode-A note (Step 9), `.mcp.json` +
  `.vscode/mcp.json` (Step 10), governance doc templates (Step 12), `.github/skills/spec-driven-core`
  (Step 17), CREDENTIALS.md credential scaffold (Step 18), loading-library lock (Step 19), design-token
  + privacy + layout-fidelity + AdminCN-starter scaffolds (Steps 20/20b/20c/20d), git init + STATE.md
  (Step 16).

**The exact ordered command/step sequence for Orqafy (see §7 for the dispatchable task form):**

1. `mkdir -p .ai_prompt` and copy the framework V32 reference files into it from
   `Powerbyte-AIEF/specdrivenprompt/` (the `.md` deliverables listed in `deploy.sh:38-241` + `starter/`).
   **Local only — `.ai_prompt/`, `AI/`, `starter/admincn/` are already gitignored + guard-blocked.**
2. `bash <path>/deploy.sh` from the repo root → arranges `CLAUDE.md`, the 7 `.ai_prompt/` detail files,
   framework scripts, and appends its machine-local ignores. **Then immediately re-verify the AGPL
   boundary** (`git check-ignore CLAUDE.md .ai_prompt AI .claude`; `bash scripts/check-public-assets.sh
   --tracked`) — see Risk R-1.
3. Author **`inputs.yml` + `inputs.schema.json`** (§2) from D-1…D-24 + PRODUCT.md — this app skips the
   Phase 2 interview because the spec already exists.
4. Run the **bootstrap Steps that create MISSING scaffolding only** (Steps 1,3,4,5,6,7,8-partial,9,10,12,
   16-partial,17,18,19,20abcd), each guarded to NOT overwrite an existing approved doc (Risk R-2).
5. Generate `.env.dev` + `.env.example` with Rule-22 non-standard ports (§6), Phase-3 artifact.
6. Phase 0 exit gate: `grep -c "⏳" CREDENTIALS.md` on REQUIRED fields = 0 (`phases.md` Phase 5 gate),
   asset guard `--tracked` green, `git status` clean/branch-isolated.

**What each produces:** step 1-2 = the local framework brain (never shipped); step 3 = the locked project
config every later Part reads (`phases.md`: "Claude Code derives everything from inputs.yml — never
hardcodes"); step 4 = the empty-but-shaped monorepo governance skeleton; step 5 = dev secrets/ports;
step 6 = a verifiable "ready for Phase 4 build" state.

---

## 2. Proposed `inputs.yml` (exact values for Orqafy)

Derived from D-1…D-24 + PRODUCT.md. Values are proposals for owner ratification; the schema shape follows
`phases.md` Phase 3 §5c.

```yaml
app:
  name: "Orqafy Self-Hosted"
  slug: orqafy                      # → COMPOSE_PROJECT_NAME=orqafy_dev, DB orqafy_dev, package scope
  namespace: "@orqafy"             # pnpm workspace package namespace → @orqafy/db, @orqafy/shared, …
  description: "Free, self-hosted construction PM + file sync + geofenced site tasks."
  license: AGPL-3.0                  # D-2 (public repo; framework files shipped-without)
  repo_visibility: public           # D-2

tenancy:
  multi_tenant: false                # D-5 — single-company install, schema carries NO tenant_id
  model: single                      # fleet 3-tier tenant RBAC + universal creds DO NOT apply (D-5)

rbac:
  standard: app_local                # role + custom permission-group + per-user override (D-17)
  # NOT the fleet tenant-rbac-standard.md — see PRODUCT "User Roles & Access Control"
  first_admin: interactive_first_run # D-5 — operator creates own admin; NO Powerbyte universal creds

docker:
  publish: false                     # OWNER-CONFIRMED 2026-09-08 + D-3 — Phase 4 Part 8 SKIPS
                                     # docker-publish.yml entirely (phases.md Phase 3 §5c)
  # registry / hub_repo / image_name / platforms / build_on_push_to — OMITTED (publish:false)
  dev_build: true                    # dev compose always rebuilds from source

deployment:
  manager: none                      # no Komodo, no CI auto-deploy (ships as a Compose bundle, D-3)

payment:
  gateway: none                      # no Xendit (no billing in this product)

context7:
  enabled: true                      # Rule 30 — live library docs during Phase 4

accessibility:
  level: wcag_aa                     # D-20 — WCAG 2.2 AA is a build target; gov_lgu_flag: false

privacy:
  gov_lgu_flag: false                # D-20 — generic product; installing firm is data controller
  regime: ph_dpa                     # RA 10173 baseline; SPI = payroll docs + sick-leave context

apps:
  - id: web
    framework: nextjs                # D-1, D-8 — Next.js + tRPC + Auth.js v5
    realtime: websocket              # D-22 — live kanban + notifications
  - id: mobile
    framework: expo                  # D-6, D-8 — Expo/React Native, sideload/self-build, offline-first
    offline_first: true              # D-15
    geofencing: true                 # D-19, R6 — native build only, on-device, iOS 20-region cap
    distribution: self_build         # D-6 — no store listing
  - id: desktop
    framework: tauri                 # D-7, D-11 — client-only thin shell (server stays Compose)
    non_ts_surface: rust_sidecar     # D-11 — sole non-TS code; sidecar supervision only

stack:                               # D-1 locked AIEF stack (informational; framework already assumes it)
  db: postgres
  cache: valkey
  queue: bullmq
  storage: minio                     # → S3-compatible; NAS/NFS or local-disk, same code path (R-2)
  ui: shadcn                         # + Kibo UI (kanban/Gantt/dropzone) + Leaflet/OSM (D-22, D-23)
  language: typescript               # D-8

entities_v1:                         # PRODUCT "Core Entities" — schema finalised at Phase 4 Part 3
  - Organization
  - User
  - PermissionGroup
  - Client
  - Project
  - Task            # carries location{lat,lng,radiusMeters} + geofenceActiveFrom/Until (D-19)
  - Milestone
  - Document        # storageKey, category, ocrText, ocrStatus, isSPI, revisionHistory[]
  - DocumentReview  # unsorted/review tray (D-13 thin-slice)
  - Photo
  - Notification
  - LeaveType
  - LeaveBalance
  - LeaveRequest    # D-21
  - AuditLog        # D-20 — app-layer DPA access trail

environments:
  active: [dev]                      # PRODUCT "Environments Needed" — dev only, HARD HOLD
  # ships as a Compose bundle to installing firms; NO Powerbyte staging/prod (D-3, D-15)

ports:
  dev:                               # Rule-22 non-standard, GENERATED at Phase 3 (§6) — do not hardcode
    base: <generated>                # e.g. 43xxx, random per-project to avoid fleet-local collisions
    # app / db / pgbouncer / redis / minio / minio_console / pgadmin / smtp / smtp_ui derived from base
```

---

## 3. Resulting monorepo structure (pnpm workspace)

Follows `phases.md` Phase 4 Parts 1-8, with Orqafy-specific packages added for the file-sync/OCR/geofence
domains. `apps/mobile` and `apps/desktop` are v1 targets (D-4, D-7) but scaffold in later Parts (see §8
[WHAT] on Phase-0 scope).

```
orqafy-self-hosted/
├── pnpm-workspace.yaml            # Part 1
├── turbo.json  package.json  tsconfig.base.json  .editorconfig  .prettierrc  .eslintrc.js  .nvmrc(22)
├── apps/
│   ├── web/                       # Part 5 — Next.js + tRPC + Auth.js v5 (D-1)
│   ├── mobile/                    # Part 6 — Expo/RN; geofence engine, offline queue (D-6,D-15,D-19)
│   └── desktop/                   # custom — Tauri client shell + Rust sidecar (D-7,D-11,D-14)
├── packages/
│   ├── shared/                    # Part 2 — TS types + Zod schemas for every entity
│   ├── api-client/                # Part 2 — typed tRPC client (consumed by apps only, never by db/jobs)
│   ├── db/                        # Part 3 — Prisma schema, migrations, seed, AuditLog (NO tenant_id, D-5)
│   ├── ui/                        # Part 4 — shadcn/ui + Kibo UI wrappers, tokens from DESIGN.md
│   ├── jobs/                      # Part 4 — BullMQ workers: OCR, matching, sync orch, notifications
│   ├── storage/                   # Part 4 — MinIO/S3 adapter (NFS or local-disk, same path, R-2)
│   ├── sync/                      # custom — FileSyncProvider port (nextcloudcmd driver; WebDAV fallback, D-14)
│   └── geofence/                  # custom — shared dwell/region logic (on-device eval spec, D-19/R6)
├── deploy/compose/dev/            # Part 7 — docker-compose.*.yml (§6)
├── tools/                         # Part 7 — scripts, SocratiCode artifacts
├── docs/                          # EXISTS — PRODUCT/DESIGN/DECISIONS_LOG/STATE/planning/… (never clobbered)
└── (local-only, gitignored) CLAUDE.md  .ai_prompt/  AI/  starter/admincn/  .claude/  .sessions/
```

---

## 4. AGPL boundary — gitignored paths + asset-guard coverage

**Seeded-locally-never-committed (built WITH, shipped WITHOUT — D-2):**

| Path | `.gitignore` | asset guard FORBIDDEN | Verdict |
|---|---|---|---|
| `.ai_prompt/` | ✅ | ✅ `.ai_prompt/` | covered |
| `AI/` | ✅ `AI/` | ✅ `ai/` (case-insensitive) | covered |
| `starter/admincn/` | ✅ | ✅ | covered |
| `CLAUDE.md` | ✅ | ✅ `claude.md` (ci) | covered |
| `.claude/` | ✅ | ✅ | covered |
| `.sessions/` | ✅ | ✅ | covered |

**GAPS — framework IP that bootstrap/deploy.sh seeds but the guard does NOT yet cover (flag, extend guard
before running Phase 0):**

- **`.github/skills/spec-driven-core/`** (`bootstrap.md` Step 17) — framework skill IP, tracked location,
  **NOT in `.gitignore` nor the guard.** *Highest-priority gap.*
- **Framework `scripts/*` and `*.mjs`** — `design-stop-hook.sh`, `sync-context.sh`, `spec-gap-check.sh`,
  `build-primer.sh`, `dev-freshness-check.sh`, `lint-deploy.sh`, `lint-design.sh`, `sd.config.mjs`,
  `design-fidelity.mjs` land in `scripts/`, which ALSO holds the app's own `check-public-assets.sh` — so
  it cannot be blanket-ignored. Enumerate the framework scripts, or seed them under a designated
  `.ai_prompt/scripts/` prefix.
- **`.clinerules`** (tombstone), **`.socraticodecontextartifacts.json`**, **`.mcp.json` / `.vscode/mcp.json`**
  — framework/tooling artifacts, not in the app's ignore list (the framework's own gitignore covers
  `.socraticodecontextartifacts.json`, but the app's does not).
- **`docs/tasks/phase4-part*.md`** — framework build-methodology task files placed in tracked `docs/`.
  Low IP risk but framework-authored; decide keep-local vs public.

**Recommendation:** extend `scripts/check-public-assets.sh` FORBIDDEN + `.gitignore` PUBLIC-REPO ASSET
GUARD block to add `.github/skills/`, `.clinerules`, `.socraticodecontextartifacts.json`, `.mcp.json`,
`.vscode/`, and an enumerated framework-scripts list, BEFORE step 2 of §1 runs. Re-verify with
`check-public-assets.sh --tracked` after every seeding step. (This is a HOW fix; the "which of these count
as IP we must hide" call for the borderline items is a light [WHAT] — see §8.)

---

## 5. `CREDENTIALS.md` — dev-only secret HEADERS Phase 0 needs (never values)

`CREDENTIALS.md` is gitignored from day 1 (`.gitignore`, `bootstrap.md` Step 8). Bootstrap Step 18
auto-generates AI-producible secrets. Applying the `phases.md` Phase 5 REQUIRED/OPTIONAL gate to THIS
app (dev-only, publish:false, no payments, no deploy manager):

**REQUIRED for Phase 0 (local dev) — headers only:**
- `## PostgreSQL (dev)` — DB password (generated 22-char)
- `## PgBouncer (dev)` — auth password
- `## Valkey / Redis (dev)` — requirepass
- `## MinIO (dev)` — root user + root password (console access)
- `## Auth.js v5 (dev)` — `AUTH_SECRET` (`openssl rand -base64 32`) + `AUTH_URL` (non-secret)
- `## Local Dev Admin (dev seed)` — email + generated password **for local dev seeding only.**
  ⚠ D-5: production uses **interactive first-run setup**, NO Powerbyte universal creds, NO tenant roles.
  Whether a seeded dev admin is even acceptable vs interactive-only-in-dev is a light [WHAT] (§8).

**NOT required (framework gate lets ⏳ remain / section omitted):**
- 🐙 GitHub PAT, 🐳 Docker Hub token → **omit** (publish:false, no CI, no remote — HARD HOLD)
- 📧 SMTP → **omit** (dev uses MailHog)
- 🦎 Komodo, 💳 Xendit, 🛡️ Cloudflare Turnstile → **omit** (no deploy manager / no payments / dev)
- **BYO LLM API key (D-16)** — a runtime SETTINGS toggle, off by default, NOT a Phase-0 credential.

---

## 6. Dev Docker Compose services + WSL2 port auto-assign

**Base framework dev services** (`phases.md` "Common Full Workflow" compose specs, `deploy/compose/dev/`):
- `postgres` (+ named volume, healthcheck) — start FIRST (`docker-compose.db.yml`)
- `pgbouncer` (edoburu/pgbouncer, transaction pool)
- `valkey` (valkey/valkey:7-alpine, requirepass, appendonly) — BullMQ backend
- `minio` + console — S3-compatible object storage (NFS-mount or local disk, same path, R-2)
- `mailhog` — dev SMTP capture
- `pgadmin` — pre-wired `pgadmin-servers.json` (connects via internal hostname `orqafy_dev_postgres`)
- `worker` — BullMQ jobs container (OCR/matching/sync-orchestration/notifications/roll-ups). **Rebuild
  the worker alongside the app** — an app-only `--build` leaves the worker stale (deploy-discipline).
- `app` — Next.js dev (rebuild-from-source, `dev_build:true`)

**Orqafy-specific compose additions** (feature-phase, wrapped as black-box sidecars — D-8, never modified):
- `nextcloud` (+ its own DB) — file-sync engine (D-10). ~530 MB + a second DB (accepted cost).
- `ocr` sidecar — RapidOCR/Tesseract, Apache-2.0 lane (D-13, licence-clean).
- `ollama` (optional, off) — document-AI v1.x/v2 only (D-16).
> These are planned bundle members, NOT part of the base Phase-0 scaffold; add when their feature Part is
> built so the Phase-0 stack stays minimal.

**WSL2 port auto-assign (Rule 22 Part A):** dev services use **non-standard random ports derived from a
per-project random base** (e.g. base 42731 → postgres 42731, valkey 42733, minio 42734, app 42741 —
`phases.md` Phase 6). The base is generated ONCE at Phase 3 into `inputs.yml ports.dev` and locked into
`.env.dev` (never regenerated — regenerating invalidates running containers). Randomised per-project so
the many fleet stacks on one WSL2 box never collide; Docker Desktop publishes them to `localhost:<port>`
natively (no DinD, no socket mounts). Conflict handling: regenerate ports in `inputs.yml` → Phase-7
rewrite → restart (`docs/memory/lessons.md` seeded gotcha, `bootstrap.md` Step 5).

---

## 7. Sequenced worker-task breakdown (dispatch after approval)

Dependency-ordered. **P0** = the Phase-0 scaffold itself; **B** = the Phase-4 build (framework Parts 1-8,
Orqafy-adapted). Each runs in a fresh session, branch-per-Part, lint+typecheck gate, STATE.md rewrite,
squash-merge, STOP (`bootstrap.md` Step 4 pattern). NONE push (HARD HOLD).

**Phase 0 — scaffold (do first, in order):**
- **P0.1 · Extend the asset guard (§4 gaps).** Add `.github/skills/`, `.clinerules`,
  `.socraticodecontextartifacts.json`, `.mcp.json`, `.vscode/`, enumerated framework scripts to
  `check-public-assets.sh` + `.gitignore`. *Done/verify:* `check-public-assets.sh --staged` unit-checks a
  fixture of each new path → refused. Branch `chore/asset-guard-extend`.
- **P0.2 · Seed framework locally + deploy.sh.** `mkdir .ai_prompt`, copy specdrivenprompt files, run
  `deploy.sh`. *Done/verify:* `CLAUDE.md` + `.ai_prompt/` present; `git check-ignore` confirms all six
  boundary paths ignored; `check-public-assets.sh --tracked` green; `git status` shows NO framework path
  staged. (Depends P0.1.)
- **P0.3 · Author `inputs.yml` + `inputs.schema.json`** (§2) from D-1…D-24. *Done/verify:* file validates
  against schema; `docker.publish:false`, `multi_tenant:false`, `namespace:@orqafy`, `license:AGPL-3.0`
  present. (Depends P0.2.)
- **P0.4 · Non-destructive bootstrap steps.** Run Steps 1,3,4,5,6,7,9,10,12,17,18,19,20abcd + the MISSING
  parts of 8/16 (.nvmrc, minimal package.json, .claude/settings.json + Stop hook, docs/tasks/,
  docs/memory/, CREDENTIALS.md scaffold). **GUARD:** never overwrite existing `docs/PRODUCT.md`,
  `DESIGN.md`, `DECISIONS_LOG.md`, `STATE.md`, `TASK_QUEUE.md`, `SESSION_LOG.md`, `PENDING_DECISIONS.md`,
  `README.md`, or the app's `.gitignore`. *Done/verify:* `git diff` on those files = empty; new scaffold
  files present; `.claude/settings.json` has the Stop hook. (Depends P0.3.)
- **P0.5 · Generate `.env.dev` + `.env.example` + ports** (§6), Rule-22 base. *Done/verify:*
  `cat .env.dev | grep _PORT` lists all services; `.env.dev` gitignored, `.env.example` tracked with
  placeholders only. (Depends P0.4.)
- **P0.6 · Phase-0 exit gate.** *Done/verify:* `grep -c "⏳" CREDENTIALS.md` on REQUIRED headers = 0;
  `check-public-assets.sh --tracked` green; STATE.md says "Phase 0 complete, next: Phase 4 Part 1";
  tree clean, branch-isolated, unpushed.

**Phase 4 — build (framework Parts, after Phase 0 gate):**
- **B1 · Part 1 root config** — pnpm-workspace, turbo, tsconfig.base (strict), eslint/prettier, final
  .gitignore-merge (preserve AGPL block), .nvmrc. *Verify:* `pnpm install --frozen-lockfile` + `pnpm lint`
  + `pnpm typecheck` green.
- **B2 · Part 2 `@orqafy/shared` + `@orqafy/api-client`** — TS types + Zod for all §2 entities; tRPC
  client. *Verify:* typecheck green; api-client imports neither db nor jobs.
- **B3 · Part 3 `@orqafy/db`** — Prisma schema for v1 entities, **NO `tenant_id`** (D-5), migrations
  (up+down), seed, `AuditLog`. **Seed OVERRIDE:** the app's own `Owner/Admin` role + interactive first-run
  (NOT the framework's tenant_superadmin/tenant_manager seed, NOT Powerbyte universal creds — D-5).
  *Verify:* `pnpm db:generate` + typecheck green; grep confirms no `tenant_id` and no Powerbyte email in
  seed. (Depends B2.)
- **B4 · Part 4 `@orqafy/ui` + `@orqafy/jobs` + `@orqafy/storage`** (+ custom `sync`, `geofence` ports) —
  BullMQ workers, MinIO adapter, shadcn/Kibo wrappers with DESIGN.md tokens. *Verify:* typecheck green;
  storage adapter has NFS + local-disk path (R-2).
- **B5 · Part 5 `apps/web`** — Next.js + tRPC + Auth.js v5, websocket realtime (D-22), dashboard per D-22,
  AdminCN baseline grafted to tRPC/Prisma (never AdminCN fake-db). *Verify:* app boots on dev port;
  auth + one CRUD flow exercised (Playwright verify-all-pages, evidence not self-report). (Depends B3,B4.)
- **B6 · Part 6 `apps/mobile`** (Expo) — offline-first (D-15), on-device geofence engine (D-19/R6, native
  build only, iOS 20-region re-arm), outbound queue. *Verify:* typecheck; geofence task registers.
- **B7 · `apps/desktop`** (Tauri, custom Part) — client shell + Rust sidecar supervising `nextcloudcmd`
  (D-14, debounced fs-watch + timer). *Verify:* sidecar surface documented as sole non-TS code (D-11).
- **B8 · Part 7 + Part 8** — `deploy/compose/dev/` (§6, **no `docker-publish.yml`** — publish:false),
  tools/, SocratiCode artifacts, governance docs, MANIFEST. *Verify:* `bash deploy/compose/start.sh dev
  up -d` brings the base stack healthy; dev-freshness-check green.

---

## 8. Risks / blockers + owner `[WHAT]`s

**Risks / blockers (HOW — Architect resolves; flagged for awareness):**
- **R-1 · deploy.sh CLAUDE.md overwrite + gitignore append vs the AGPL boundary.** deploy.sh writes
  project-root `CLAUDE.md` (already gitignored → stays local, OK) and append-only-manages `.gitignore`
  (won't remove the app's ignore rules). Residual risk: a stray `!CLAUDE.md`/`!.ai_prompt/` negation, or a
  framework "DO NOT GITIGNORE" comment being misread. **Mitigation:** after P0.2, hard-verify
  `git check-ignore` on all six boundary paths + `check-public-assets.sh --tracked`. Never let a later
  framework sync re-track them.
- **R-2 · Bootstrap clobbering approved docs.** Steps 12/16 write governance doc templates + STATE.md; the
  approved `PRODUCT.md`/`DESIGN.md`/`DECISIONS_LOG.md`/`TASK_QUEUE.md` etc. already exist. **Mitigation:**
  P0.4 runs the create-if-missing subset only; `git diff` on the approved docs must stay empty.
- **R-3 · Asset-guard gaps (§4)** — `.github/skills/` + framework scripts would enter public history.
  **Mitigation:** P0.1 extends the guard BEFORE any seeding.
- **R-4 · Framework seed defaults (tenant roles + Powerbyte universal creds)** contradict D-5.
  **Mitigation:** B3 overrides Part-3 seed to the app's own role model + interactive first-run.
- **R-5 · Three BLOCKED backlog tasks** (geofence-over-tunnel, sync-engine resource cost, Pangolin
  throughput — `docs/TASK_QUEUE.md`) need real hardware/running stack/live tunnel. They gate LATER phases,
  **not Phase 0** — no impact on scaffold; keep tracked.
- **R-6 · Exact library/CLI versions** (Next.js, Prisma, Auth.js v5, Expo, Tauri, valkey) — framework pins
  Node 22 + pnpm 10 (`bootstrap.md` Step 8). Exact minor/patch versions are **unverified in this plan**;
  Phase-4 Part workers MUST resolve them via context7 at build time (cite library id, flag unverified) —
  not pinned here to avoid guessing stale versions.

**Owner `[WHAT]`s (flag, do NOT decide — record in `PENDING_DECISIONS.md`):**
- **W-1 · Phase-0 scaffold breadth:** scaffold `apps/web` only first (fastest to a running vertical
  slice), or all of web+mobile+desktop in the initial build wave? Affects effort and the B6/B7 ordering.
- **W-2 · Local-dev admin seed vs interactive-only:** D-5 mandates interactive first-run for real installs
  and forbids Powerbyte creds. Is a **generated dev-only** admin (stored in gitignored CREDENTIALS.md)
  acceptable for local dev convenience, or must dev ALSO be interactive-first-run? (Touches the credential
  posture, hence [WHAT].)
- **W-3 · Borderline-IP local files:** confirm `docs/tasks/phase4-part*.md`, `.clinerules` tombstone, and
  `.mcp.json` should be **local-only (hidden)** vs allowed public. §4 recommends hiding; owner ratifies.
- **W-4 · AdminCN starter usage:** D-2 forbids committing `starter/admincn/`, but the framework's default
  design baseline IS AdminCN (paid slice). Confirm the web UI **inherits AdminCN structure locally then
  ships only the derived, data-decoupled shadcn/ui output** (no AdminCN files in history) — vs building the
  shell from plain shadcn/Kibo to avoid the paid slice entirely.

---

*Plan doc only. No scaffold, no code, no bootstrap run, no deps installed, no git commit performed by this
task. Execution awaits explicit owner approval + the Phase-0 gate. HARD HOLD — local only.*
