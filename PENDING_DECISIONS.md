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

- [ ] **[WHAT] Production compose — author now, or stay dev-only? (audit M-4b, surfaced 2026-10-10)**
      The v0.1.1 audit fix M-4 was "bind dev ports to 127.0.0.1 **+ ship a prod compose**." The binding
      half (**M-4a**) is done — un-gated security fix, branch `fix/audit-m4-compose-bind`. The **prod-compose
      half is deferred** because it is a deploy-posture/topology decision, not a [HOW]:
      • This repo ships **dev-only** by lock — `deploy/compose/start.sh` hard-refuses any non-dev env
        ("only the 'dev' environment exists, HARD HOLD, D-3"), and only `deploy/compose/dev/*` exists.
      • Staging/demo deploy to **EC2-Komodo**, prod to **Hostinger** (infra broadcast 2026-09-11) — those
        stacks are Komodo-managed (files-on-host), so a correct prod compose needs the Komodo/Traefik labels,
        image-registry source, mandatory resource limits (framework V32.10), and SOPS-sourced secrets, none of
        which should be guessed into a **public AGPL repo**.
      DECISION NEEDED: (a) author a canonical hardened prod compose in-repo now (owner confirms topology:
      Komodo-managed vs standalone, image source, secrets wiring); (b) keep the repo dev-only and treat the
      prod/staging stack as server-side (Server-Setups / Komodo), scoping M-4b OUT of the release; (c) defer
      to a dedicated post-v0.1.1 infra task. **Recommendation: (b)** for v0.1.1 — the binding fix already
      removes the LAN-exposure risk; the prod stack is an infra-topology concern better owned server-side.
      ⚠ This is the ONLY item blocking the "all 10 fixes done → merge+push v0.1.1" gate; the other 9 fixes
      (H-1…H-5, M-1…M-3, M-4a, M-5) are independent and will be merged/pushed once M-4b is answered or scoped out.
      Back-port to `docs/DECISIONS_LOG.md` once answered.

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
