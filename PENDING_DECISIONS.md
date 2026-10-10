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
      **⚠ Asset-source sub-gate still open** — the repo has no Orqafy logo/favicon asset yet, and the
      commercial Orqafy logo is a separate product (read-only, not to be lifted). The UI wiring cannot
      proceed until the owner settles where the Orqafy-Self-Hosted logo comes from (owner-supplied file /
      generate a new mark / text wordmark placeholder). Tracked in `docs/TASK_QUEUE.md` (ORQ-37).

## ✅ Resolved (2026-09-27, resume session — continued)

- [x] **D-30 Desktop track (R7a §7 Q1–Q3)** → deferred post-v1; reuse `apps/web` in the Tauri WebView; Auth.js cookie session same-origin (Q4–Q7 parked).
- [x] **D-31 First public release** → public repo `bonitobonita24/Orqafy-Self-Hosted`, `main` + tag `v0.1.0` pushed as-is (gitleaks clean, CI green).
- [x] **D-32 Audit fix scope** → fix H-1…H-5 + M-1…M-5 on per-fix branches, then push release v0.1.1 (pre-authorized once gates green); L-1…L-10 to backlog.

## 🔴 Open

- [ ] **[WHAT] Audit L-3 — non-SPI document download scope** (surfaced 2026-10-10, Wave B). Any signed-in
      user can download any document NOT flagged SPI — this matches what `documents.list` already shows them.
      Options: (a) accept as designed (single-company install; non-SPI docs are org-shared) and document it;
      (b) restrict download to assignees of the document's project + oversight roles (`view_all_projects`).
      **Recommendation: (a).** Back-port to PRODUCT.md (Files section) + DECISIONS_LOG once answered.
- [ ] **[WHAT] Password change / admin reset — not in v1 spec** (surfaced 2026-10-10 while scoping audit
      L-2). PRODUCT.md has no password change or reset flow; the only password write is at user creation
      (`users.create`, first-run `setup`). A user who forgets their password has no recovery path, and audit
      L-2 (revoke the 60-day mobile token on password change) has nothing to hook into. Deactivation already
      revokes access (per-request `isActive` re-check). Options: (a) add self-service "change password" +
      admin "reset password" (`manage_users`), each bumping a `passwordChangedAt` that invalidates older
      mobile tokens (closes L-2); (b) admin reset only; (c) leave out of v1. **Recommendation: (a)** — a
      shipped multi-user app needs a recovery path, and it closes L-2 for free. No email-based reset (no
      SMTP assumption in a LAN-first install).
- [ ] **[WHAT] DPA wave defaults (Phase 5 F-2 build, 2026-10-10)** — building now with the conservative,
      reversible defaults below; confirm or change:
      (1) **Breach-notification path** — NOT in PRODUCT.md/D-20 (only a framework gap-reminder). Default:
      **not built** (Rule 10). Optional later: minimal `breach_incident` audit action + DPO checklist page.
      (2) **Retention categories** — `audit_log, notification, photo, document, completed_project,
      leave_request`; 0/absent = never auto-delete; SPI/payroll never a category. Retention job ships
      **dry-run by default**.
      (3) **Erasure vs SPI/payroll docs** — default **retain** (controller's legal records); uploader
      reference is pseudonymized.
      (4) **Who can erase** — default **admin-only** (`manage_users`); every user can self-export.

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
