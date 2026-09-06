# Pending Decisions — Orqafy-Self-Hosted

Owner-gated `[WHAT]` decisions. `[HOW]`/technical items are resolved by the agent, never parked here.
Answered decisions get back-ported into `docs/PRODUCT.md` + `docs/DECISIONS_LOG.md` before any build.

## ✅ Resolved (2026-09-06, founding session)

- [x] **D-1 Kaneo usage** → AIEF locked stack; Kaneo as UI/UX + domain reference only.
- [x] **D-2 License & visibility** → AGPL-3.0, public repo.
- [x] **D-3 Server install form** → Docker Compose first; native desktop installer is a later track.
- [x] **D-4 v1 scope** → Phased: PM + file management + geofenced notifications + mobile in v1;
      invoicing / POs / inventory / expenses in v2.

## 🔴 Open

- [ ] **[WHAT] Feature boundary vs commercial Orqafy.** Which commercial features are deliberately
      absent from the self-hosted edition, and which are intentionally *better* here? Needed before
      PRODUCT.md §12 (Out of Scope) can be finalised. Gate: the Planning Assistant interview.
- [ ] **[WHAT] Multi-tenancy shape.** Is a self-hosted install single-company (one org, many clients
      and projects) or does it keep the tenant model? Drives the whole schema + RBAC design.
      Recommendation to put to the owner: **single-company install, clients as first-class records** —
      simpler for a construction firm, and tenancy can be added later if a hosted edition appears.
- [ ] **[WHAT] Mobile distribution.** Play Store / App Store listing under Powerbyte, or sideload +
      self-hosted build only? Affects Expo config, signing, and whether store review constrains the
      background-location justification.
