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

- [ ] **[WHAT] Field-staff photo-upload permission** (surfaced 2026-09-10, ORQ-23) — the mobile photo-capture
      screen has no server write path, and the only upload route (`/api/media`→`documents.create`) is gated on
      permission `manage_files`, which field/site staff likely do NOT hold. DECISION NEEDED: should an assigned
      field worker be able to upload a site photo against a task they're assigned to *without* full
      `manage_files`? Options: (a) a new narrow task-scoped photo permission + `photos.create` procedure; (b) an
      assignee-check bypass on a photo-only endpoint; (c) grant field staff `manage_files` (broad — likely too
      much). Recommendation: (a). Blocks the photo-capture piece of the mobile wave. Back-port to PRODUCT.md +
      DECISIONS_LOG once answered.

- [x] **[WHAT] Feature boundary vs commercial Orqafy** → RESOLVED in the interview. The
      self-hosted edition's line: **includes** PM + files + geofence + mobile + leave management +
      document-AI (thin slice v1, full v2) + the v2 finance modules + a v2 client portal. **Excludes**
      attendance/timekeeping, payroll processing, full accounting ledger, BIM/CAD viewing, tenancy,
      worker location history, and parity with commercial Orqafy. See `docs/PRODUCT.md` Out of Scope
      and D-17…D-23.


## ✅ Resolved (2026-09-06, v1-scope resolution)

- [x] **Document-AI phasing** → **D-13**: thin slice (no LLM) in v1 ~3–4 wks; full version later.
- [x] **Desktop sync client (was D-10a)** → **D-14**: headless Nextcloud client sidecar'd behind our
      Tauri UI, one app. Caveat: headless one-shot behaviour → verify continuous-sync approach
      (queued); fallback is WebDAV-in-our-client.
- [x] **Remote access v1 vs add-on** → **D-15**: add-on, not the v1 bar. v1 is LAN-first; mobile is
      offline-first so geofencing works with no server contact.
- [x] **Local-AI hosting model** → **D-16**: local-only default; bring-your-own-key opt-in, off by
      default, warned.
