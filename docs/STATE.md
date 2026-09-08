# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-08 · **Phase 0 complete, next: Phase 4 Part 1.** Monorepo config seeded (inputs.yml, .nvmrc, package.json, dev ports/env, CREDENTIALS.md dev seed); framework brain seeded LOCAL-ONLY (gitignored + asset-guard verified). Spec approved; `docs/DESIGN.md` + `docs/MOCKUP.jsx` done; Dashboard mockup PNG previously delivered.

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **Nothing is built.** No scaffold, no `package.json`, no schema. The project is at pre-Phase-0.
3. **`docs/PRODUCT.md` is APPROVED** (owner-approved 2026-09-07). `docs/DESIGN.md` + `docs/MOCKUP.jsx`
   (9 screens) are written; `mockup-dashboard.png` (Dashboard screen only) rendered and **delivered to
   the owner 2026-09-08 for confirmation.** ⚠ **Owner has NOT yet explicitly confirmed the mockup** —
   that confirm is the gate before Phase 0. Only the Dashboard is captured as a PNG; the other 8 screens
   live in MOCKUP.jsx (render them if the owner wants to review those too).
4. **Open `[WHAT]`s** in `PENDING_DECISIONS.md`: **0** — all product decisions resolved (D-1…D-23).
   (Mockup confirm is a build-gate acknowledgement, not a tracked `[WHAT]` decision.)
5. **Backlog:** `docs/TASK_QUEUE.md` — open items are build/verify tasks (public-repo asset guard +
   the queued verification tasks: geofence-over-tunnel, headless-sync, Pangolin throughput,
   offline-first mobile, sync resource-cost, Expo background-geofence). Interview + R-1…R-5 are ✅.

## Where things stand

- Repo created, `git init`, first commit. **No remote** — local only, HARD HOLD.
- Branch `master` renamed to **`main`** (docs already assumed `main`; drift corrected).
- **R-1…R-4 research dispatched** as parallel agents → each writes a decision doc to
  `docs/planning/`. Un-gated; results fold into the interview.
- Planning artifacts only: `SEED_BRIEF.md`, `PENDING_DECISIONS.md`, `TASK_QUEUE.md`, `README.md`,
  `.gitignore` (with the public-repo asset guard).
- Framework files (`.ai_prompt/`, `AI/`) are **not** deployed here yet. When Phase 0 runs, they are
  used but **must stay gitignored** — this repo is AGPL-public and cannot carry framework IP or the
  paid AdminCN slice.

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

1. ~~Owner confirm of the mockup~~ + ~~Phase 0 scaffold~~ ✅ **DONE 2026-09-08.**
2. ~~Public-repo asset guard~~ ✅ **DONE 2026-09-08** — `scripts/check-public-assets.sh` +
   `scripts/install-git-hooks.sh` (pre-commit + pre-push) refuse framework IP / AdminCN slice; verified.
   Extended in P0.1 to cover framework tooling (`.github/skills/`, `.mcp.json`, `.vscode/`, framework
   scripts, sd.config.mjs, etc.).
3. **NEXT → Phase 4 Part 1** (root config: pnpm-workspace/turbo/tsconfig — `docs/tasks/phase4-part1.md`,
   gitignored local). Web-first (D-25) — apps/web only in the initial build wave.
4. Verification tasks queued in `docs/TASK_QUEUE.md` (geofence-over-tunnel, headless-sync feasibility,
   Pangolin throughput, offline-first mobile, sync resource cost, Expo background-geofence) — resolve
   before their phase.

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
