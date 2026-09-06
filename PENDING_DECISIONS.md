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

- [ ] **[WHAT] File-sync engine — final pick.** ⏳ **Awaiting R-3b.** R-3 picked Nextcloud, but that
      predates D-7 (desktop client apps) and D-8 (TypeScript-only). Re-comparison in flight:
      Nextcloud vs Syncthing vs sync-against-our-own-API, judged on bundling into a desktop installer,
      language discipline, server-authoritative access control, and behaviour over a throughput-limited
      relay tunnel. Owner decides once `docs/planning/R3b_FILE_SYNC_REVISED.md` lands. This choice
      **overturns or confirms a prior in `docs/SEED_BRIEF.md`** (Syncthing), so it is the owner's call.

- [ ] **[WHAT] Is remote access a v1 requirement or an optional add-on?** D-9 settled *where* Pangolin
      runs (dedicated VPS) but not *whether every install must have one*. A VPS requirement sits
      awkwardly against the "free, runs on your own desktop" pitch, and the no-VPS fallback (Traefik +
      Let's Encrypt + port-forward) only works where the site has a routable IP — many will not.
      Decide: LAN-only as the supported default with remote access as a documented add-on, or remote
      access in the v1 bar. Evidence: `docs/planning/R1_REMOTE_ACCESS.md`, `R1a_PANGOLIN_SIZING.md`.
