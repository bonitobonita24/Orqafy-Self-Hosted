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
