# STATE — Orqafy-Self-Hosted

**Last updated:** 2026-09-06 · founding session (spec seeded from the AIEF seat)

## ⏳ COLD-START CHECKLIST (read first)

1. **Read `docs/SEED_BRIEF.md` in full.** It is the founding authority — the owner's complete brief
   plus 4 confirmed decisions. Do not re-ask what it already settles.
2. **Nothing is built.** No scaffold, no `package.json`, no schema. The project is at pre-Phase-0.
3. **First real task:** run the **Planning Assistant** interview → `docs/PRODUCT.md` (12 sections).
   Seed it with the brief so the owner is only asked what is genuinely open.
4. **Open `[WHAT]`s** in `PENDING_DECISIONS.md` (3): feature boundary vs commercial Orqafy ·
   multi-tenancy shape · mobile distribution. All are interview inputs — surface them there.
5. **Backlog:** `docs/TASK_QUEUE.md` — 8 open 🔴 (interview, R-1…R-4 research, Expo geofence check,
   public-repo asset guard, DESIGN.md + MOCKUP.jsx).

## Where things stand

- Repo created, `git init`, first commit on `main`. **No remote** — local only, HARD HOLD.
- Planning artifacts only: `SEED_BRIEF.md`, `PENDING_DECISIONS.md`, `TASK_QUEUE.md`, `README.md`,
  `.gitignore` (with the public-repo asset guard).
- Framework files (`.ai_prompt/`, `AI/`) are **not** deployed here yet. When Phase 0 runs, they are
  used but **must stay gitignored** — this repo is AGPL-public and cannot carry framework IP or the
  paid AdminCN slice.

## Decisions already locked (do not reopen without the owner)

D-1 AIEF locked stack, Kaneo as reference only · D-2 AGPL-3.0 public · D-3 Docker Compose first,
native installer later · D-4 phased v1 (PM + files + geofence + mobile), v2 (invoicing/PO/inventory/
expenses). Detail + rationale: `docs/SEED_BRIEF.md` §2.

## Hard constraints carried forward

- **Geofencing is native-only** — Expo app required; iOS PWAs have no background location.
- **Public repo ⇒ no framework files, no AdminCN slice, ever.**
- **HARD HOLD** — local only; no staging/prod/deploy without the owner's explicit word.

## Next un-gated work

Planning Assistant interview, and R-1…R-4 research (can run in parallel with the interview).
