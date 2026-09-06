# Pending Decisions — Orqafy-Self-Hosted

Owner-gated `[WHAT]` decisions. `[HOW]`/technical items are resolved by the agent, never parked here.
Answered decisions get back-ported into `docs/PRODUCT.md` + `docs/DECISIONS_LOG.md` before any build.

## ✅ Resolved (2026-09-06, founding session)

- [x] **D-1 Kaneo usage** → AIEF locked stack; Kaneo as UI/UX + domain reference only.
- [x] **D-2 License & visibility** → AGPL-3.0, public repo.
- [x] **D-3 Server install form** → Docker Compose first; native desktop installer is a later track.
- [x] **D-4 v1 scope** → Phased: PM + file management + geofenced notifications + mobile in v1;
      invoicing / POs / inventory / expenses in v2.

## ✅ Resolved (2026-09-06, resume session)

- [x] **D-5 Multi-tenancy shape** → **Single-company install.** One org per install; clients and
      projects are first-class records under it. No `tenant_id`, no tenant model. The fleet 3-tier
      tenant-RBAC standard and the universal login credentials **do not apply to this app** — it is a
      public AGPL product installed by third parties, so first-run setup creates the owner's own
      admin account. Rationale + full consequences: `docs/DECISIONS_LOG.md` D-5.
- [x] **D-6 Mobile distribution** → **Sideload / self-build only**, no store listing under Powerbyte.
      Android APK is the primary mobile surface; **iOS needs TestFlight or the user's own Apple dev
      account — a known limitation to state plainly in the README.** Keeps the background-location
      justification unconstrained by store review. Rationale: `docs/DECISIONS_LOG.md` D-6.

## 🔴 Open

- [ ] **[WHAT] Feature boundary vs commercial Orqafy.** Which commercial features are deliberately
      absent from the self-hosted edition, and which are intentionally *better* here? Needed before
      PRODUCT.md §12 (Out of Scope) can be finalised. Gate: the Planning Assistant interview — this
      one genuinely needs the interview's back-and-forth, not a single answer.

- [ ] **[WHAT] Accept Nextcloud over Syncthing for file sync?** R-3 recommends **Nextcloud** (Team
      folder per project) and **rejects Syncthing** — it has no user model, so server-authoritative
      per-user project-scoped access would have to be hand-written by us. The argument is sound, but
      this **overturns a prior stated in `docs/SEED_BRIEF.md`** (the founding authority), so it is the
      owner's call, not a research doc's. Open sub-risk: Nextcloud is far heavier than Syncthing on a
      desktop-as-server box already running Postgres + Valkey + MinIO — resource sanity check is queued
      in `docs/TASK_QUEUE.md`. Evidence: `docs/planning/R3_FILE_SYNC.md`.

- [ ] **[WHAT] Is a small VPS an acceptable requirement for remote access?** R-1's primary
      recommendation (Pangolin CE reverse tunnel) needs a cheap VPS, which sits awkwardly against the
      product's "free, self-hosted, runs on your own desktop" pitch. The no-VPS fallback (Traefik +
      Let's Encrypt + port-forward) only works where the site has a routable IP — many will not.
      Decide what we are willing to require of a non-technical operator, and whether remote access is
      a v1 requirement or an optional add-on. Evidence: `docs/planning/R1_REMOTE_ACCESS.md`.
