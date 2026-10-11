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

## ✅ Resolved (2026-09-26, resume session)

- [x] **[WHAT] Field-staff photo-upload permission** → **D-28**: option (a) — narrow task-scoped photos.create + photo permission (owner, 2026-09-26).
      (surfaced 2026-09-10, ORQ-23) — the mobile photo-capture
      screen has no server write path, and the only upload route (`/api/media`→`documents.create`) is gated on
      permission `manage_files`, which field/site staff likely do NOT hold. DECISION NEEDED: should an assigned
      field worker be able to upload a site photo against a task they're assigned to *without* full
      `manage_files`? Options: (a) a new narrow task-scoped photo permission + `photos.create` procedure; (b) an
      assignee-check bypass on a photo-only endpoint; (c) grant field staff `manage_files` (broad — likely too
      much). Recommendation: (a). Blocks the photo-capture piece of the mobile wave. Back-port to PRODUCT.md +
      DECISIONS_LOG once answered.

## ✅ Resolved (2026-09-27, resume session)

- [x] **[WHAT] Orqafy branding: product logo vs Powerbyte company logo** → **D-29**: option (A) —
      Orqafy carries its OWN product logo + favicon (sidebar/login/favicon); the Powerbyte mark appears
      only in the "Developed by Powerbyte IT Solutions" footer (owner, 2026-09-27). Scopes the 2026-09-21
      official-Powerbyte-logo broadcast to the footer credit for this public AGPL product.
      **Asset-source sub-gate ANSWERED (2026-10-11):** owner chose **generate a new (original) mark** — not
      a supplied file, not the text placeholder, and never lifted from the commercial Orqafy product. 3 SVG
      concepts in production this session; owner picks one, then it's wired into sidebar/login/favicon.
      Tracked in `docs/TASK_QUEUE.md` (ORQ-37).

## ✅ Resolved (2026-09-27, resume session — continued)

- [x] **D-30 Desktop track (R7a §7 Q1–Q3)** → deferred post-v1; reuse `apps/web` in the Tauri WebView; Auth.js cookie session same-origin (Q4–Q7 parked).
- [x] **D-31 First public release** → public repo `bonitobonita24/Orqafy-Self-Hosted`, `main` + tag `v0.1.0` pushed as-is (gitleaks clean, CI green).
- [x] **D-32 Audit fix scope** → fix H-1…H-5 + M-1…M-5 on per-fix branches, then push release v0.1.1 (pre-authorized once gates green); L-1…L-10 to backlog.

## 🔴 Open

_(none — ORQ-37 logo asset source answered 2026-10-11: owner chose "generate a new mark"; concepts in
production, owner picks one before wiring — see the D-29 sub-gate note above.)_

## ✅ Resolved (2026-10-11, resume session)

- [x] **[WHAT] Audit L-3 — non-SPI document download scope** → **D-36**: option (a) accept as designed
      (owner, 2026-10-11). Single-company install; non-SPI docs are org-shared and already listed to all
      users; SPI flag stays the confidentiality boundary. Doc-only. Back-ported to DECISIONS_LOG + (draft)
      PRODUCT.md Files section.
- [x] **[WHAT] Password change / admin reset** → **D-37**: option (a) self-service change + admin reset
      (owner, 2026-10-11). Each bumps `passwordChangedAt` to invalidate older mobile tokens (closes audit
      L-2). No email reset (LAN-first). Built on `feat/orq55-password-reset` (ORQ-55).
- [x] **[WHAT] DPA wave defaults** → **D-38**: confirm all four defaults as built (owner, 2026-10-11) —
      breach-notif not built, retention dry-run, SPI/payroll retained on erase, admin-only erase +
      self-export. Doc-only back-port.

## ✅ Resolved (2026-10-10, v0.1.1 release)

- [x] **[WHAT] Production compose — author now, or stay dev-only? (audit M-4b)** → **D-33**: option (b) —
      **keep the repo dev-only; scope M-4b OUT of v0.1.1** (owner, 2026-10-10: "keep the repo dev-only, scope
      out M-4b, merge and push v0.1.1"). M-4a's 127.0.0.1 binding already removes the LAN-exposure risk; the
      prod/staging/demo stacks are Komodo-managed server-side (EC2-Komodo + Hostinger), not committed into this
      public AGPL repo. v0.1.1 ships the 9 verified fixes. Back-ported to `docs/DECISIONS_LOG.md` D-33.

## ✅ Resolved (2026-09-06, v1-scope resolution)

- [x] **[WHAT] Feature boundary vs commercial Orqafy** → RESOLVED in the interview. The
      self-hosted edition's line: **includes** PM + files + geofence + mobile + leave management +
      document-AI (thin slice v1, full v2) + the v2 finance modules + a v2 client portal. **Excludes**
      attendance/timekeeping, payroll processing, full accounting ledger, BIM/CAD viewing, tenancy,
      worker location history, and parity with commercial Orqafy. See `docs/PRODUCT.md` Out of Scope
      and D-17…D-23.

- [x] **Document-AI phasing** → **D-13**: thin slice (no LLM) in v1 ~3–4 wks; full version later.
- [x] **Desktop sync client (was D-10a)** → **D-14**: headless Nextcloud client sidecar'd behind our
      Tauri UI, one app. Caveat: headless one-shot behaviour → verify continuous-sync approach
      (queued); fallback is WebDAV-in-our-client.
- [x] **Remote access v1 vs add-on** → **D-15**: add-on, not the v1 bar. v1 is LAN-first; mobile is
      offline-first so geofencing works with no server contact.
- [x] **Local-AI hosting model** → **D-16**: local-only default; bring-your-own-key opt-in, off by
      default, warned.
