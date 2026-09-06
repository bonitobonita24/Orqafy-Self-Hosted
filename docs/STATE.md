# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-06 · resume session (D-5 + D-6 locked; R-1…R-4 research dispatched)

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **Nothing is built.** No scaffold, no `package.json`, no schema. The project is at pre-Phase-0.
3. **First real task:** run the **Planning Assistant** interview → `docs/PRODUCT.md` (12 sections).
   Seed it with the brief so the owner is only asked what is genuinely open.
4. **Open `[WHAT]`s** in `PENDING_DECISIONS.md` (**1**): feature boundary vs commercial Orqafy —
   an interview input, needs back-and-forth. Multi-tenancy (D-5) and mobile distribution (D-6) are
   now **answered**; see `docs/DECISIONS_LOG.md`.
5. **Backlog:** `docs/TASK_QUEUE.md` — 8 open 🔴 (interview, R-1…R-4 research, Expo geofence check,
   public-repo asset guard, DESIGN.md + MOCKUP.jsx).

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

Planning Assistant interview → `docs/PRODUCT.md`. R-1…R-4 research is in flight (agents dispatched
2026-09-06); fold each `docs/planning/R*.md` into the interview as it lands.
