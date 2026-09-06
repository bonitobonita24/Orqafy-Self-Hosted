# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-06 · Planning Assistant interview complete — `docs/PRODUCT.md` written, awaiting owner approval

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **Nothing is built.** No scaffold, no `package.json`, no schema. The project is at pre-Phase-0.
3. **`docs/PRODUCT.md` EXISTS** (written 2026-09-06 from the interview) — read it; it is the spec the
   build follows. **Awaiting owner approval.** Next after approval: Phase 2.8 mockup + `docs/DESIGN.md`.
4. **Open `[WHAT]`s** in `PENDING_DECISIONS.md`: **0** — all product decisions resolved (D-1…D-23).
5. **Backlog:** `docs/TASK_QUEUE.md` — open items are now build/verify tasks (DESIGN.md + MOCKUP.jsx,
   public-repo asset guard, and the queued verification tasks). Interview + R-1…R-4 are ✅.

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

1. **Owner approval of `docs/PRODUCT.md`** — the gate before anything scaffolds.
2. After approval: **Phase 2.8 mockup** (`docs/MOCKUP.jsx`) + **`docs/DESIGN.md`** (Kaneo reference,
   shadcn/ui, IBM Plex Sans + JetBrains Mono, "simple modern" per D-23).
3. Then Phase 0 scaffold. Public-repo asset guard should be wired before/with first scaffold.
4. Verification tasks queued in `docs/TASK_QUEUE.md` (geofence-over-tunnel, headless-sync feasibility,
   Pangolin throughput, offline-first mobile, Nextcloud resource cost) — resolve before their phase.
