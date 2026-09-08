# PRODUCT.md — Orqafy-Self-Hosted

> Product specification. Authored via the Planning Assistant interview, 2026-09-06, seeded from
> `docs/SEED_BRIEF.md` and decisions D-1…D-16 in `docs/DECISIONS_LOG.md`. This is the spec the build
> follows; it is not code. **HARD HOLD — local only, nothing scaffolded until this is owner-approved.**

---

## App Identity

- **App Name:** Orqafy-Self-Hosted
- **Owner:** Powerbyte I.T. Solutions (Bonito) — publisher of the open-source product
- **Industry:** Construction (engineering & architecture firms)
- **License / visibility:** AGPL-3.0, public repo (D-2)
- **One-line:** The free, open-source, self-hosted project-management, file-sync and geofenced-task
  app for construction engineers and architects — desktop-as-server, LAN-first, with native mobile.

## Purpose

Give a single construction firm a self-hosted home for running its projects: kanban/todo/Gantt project
management, Drive-like file sync with revisions, drag-and-drop document auto-filing, staff leave
management, and — the differentiating feature — **geofenced task alerts** that notify a field worker
when they physically arrive at a site where they have something to do. The firm owns its server and its
data; nothing is required to leave the premises.

**The core problem it solves:** site work is location-driven, not calendar-driven. Time-based reminders
get dismissed and you cannot predict when you will be on a given site. **Presence is the more reliable
trigger.** Around that sits the ordinary but essential machinery — projects, tasks, files, photos,
leave — that a firm otherwise scatters across chat apps, spreadsheets, and a shared drive.

## Target Users

A **single construction firm** and its people:
- **Firm owner / admin** — runs the whole system.
- **Project managers / engineers / architects** — plan and run projects (one shared permission level).
- **Field / site staff** — work assigned tasks on site, mostly from a phone.
- **Accountant / bookkeeper** — the finance modules (v2).
- **Clients** — external, read-only view of their own projects with milestone sign-off (v2).

---

## Tenancy Model

**Single-tenant (single-company install).** One organisation per install; **clients and projects are
first-class records** beneath it. The schema carries **no `tenant_id`**. Each firm runs its own server.
(D-5.) The fleet 3-tier tenant-RBAC standard and the fleet universal login credentials **do not apply**
— this is a public product installed by third parties; first-run setup creates the operator's own admin
account.

---

## User Roles & Access Control

RBAC is **role + custom permission-group + per-user override** within the one organisation. Predefined
roles are starting points; the owner can create custom groups and grant/revoke individual permissions
per user (e.g. finance visibility is a permission, not hardwired to a role). A permission builder is a
**v1 build item**, not just a fixed role dropdown.

**Predefined roles:**

| Role | Can (examples) | Cannot (restrictions) |
|---|---|---|
| **Owner / Admin** | Everything: manage users & roles, configure server, all projects, all finances, all settings | (the one immutable superadmin — created at first-run setup) |
| **Project Manager** *(engineer & architect map here — same permissions)* | Create & run assigned projects; create/assign tasks; set schedule/Gantt; upload & organise files; approve leave *(if granted)*; view project finances *(if granted)* | Manage users; configure server; see projects they are not assigned to *(configurable)* |
| **Field / Site Staff** | View assigned tasks; receive geofence alerts; capture photos against tasks/milestones; mark tasks done; apply for leave | Create/delete projects; see finances; delete others' work; manage users |
| **Accountant** *(v2)* | Invoices, POs, expenses, inventory (the finance modules) | Change project structure; manage users |
| **Client** *(v2, external)* | Read-only view of their own project (progress, milestones, milestone photos, their invoices); **sign off / reject milestones** | See internal tasks, costs, other clients, or unshared files |

**Key permissions (assignable via custom groups / per-user):** `manage_users`, `configure_server`,
`create_project`, `view_finances`, `manage_finances`, `approve_leave`, `manage_files`,
`view_all_projects`, `export_data`, `view_audit_log`.

---

## Core Entities

*(Every entity lists representative fields; the schema is finalised in Phase 3.)*

**v1**

- **Organization** — name, address, logo, dpoName, dpoContact, retentionSettings, timezone.
- **User** — name, email, passwordHash, roleId, groupIds[], phone, isActive, createdAt.
- **PermissionGroup** — name, permissions[], isSystem.
- **Client** — name, contactPerson, email, phone, address, notes.
- **Project** — name, code, clientId, status (planning/active/on-hold/completed/cancelled), startDate,
  targetEndDate, description, progressPct.
- **Task** — title, description, projectId, assigneeId, status (todo/in-progress/blocked/done),
  priority, dueDate, boardColumn, **location{lat, lng, radiusMeters}**, **geofenceActiveFrom**,
  **geofenceActiveUntil** (optional), createdBy.
- **Milestone** — projectId, title, targetDate, status, signOffStatus (pending/approved/rejected, v2),
  signedOffBy, signedOffAt.
- **Document / File** — name, storageKey, projectId?, clientId?, category
  (invoice/PO/expense/receipt/payroll/drawing/permit/photo/other), mimeType, size, ocrText, ocrStatus,
  revisionHistory[], uploadedBy, isSPI (flag).
- **DocumentReview** *(unsorted tray)* — fileId, suggestedClientId, suggestedProjectId,
  suggestedCategory, confidence, status (pending/confirmed/reassigned).
- **Photo** — storageKey, taskId?, milestoneId?, capturedBy, capturedAt, gpsLat, gpsLng.
- **Notification** — userId, type, payload, isRead, createdAt.
- **LeaveType** — name (vacation/sick/emergency/…), defaultDaysPerYear, isPaid.
- **LeaveBalance** — userId, leaveTypeId, year, entitled, used, remaining.
- **LeaveRequest** — userId, leaveTypeId, startDate, endDate, reason (optional, no required health
  detail), status (pending/approved/rejected), approvedBy, approvedAt.
- **AuditLog** — userId, action, targetType, targetId, ip, timestamp *(DPA access trail — built at app
  layer, since the sync/tunnel tools' own audit logging is enterprise-only)*.

**v2** — Invoice, PurchaseOrder, Expense, InventoryItem, **InventoryMovement** (purchased → stocked →
released to project/invoice — full chain of custody).

---

## Main Workflows

**1 — Run a project.** PM creates a project under a client → adds tasks (kanban board + todo lists) →
assigns them → sets schedule / Gantt → staff work tasks to done; progress rolls up to the project %.
- *Edge:* assigning a task to someone on approved leave → **warn before confirming**.
- *Edge:* deleting a project with active tasks → **confirm and cascade/soft-delete**, never silent loss.

**2 — Geofenced site task (the differentiator).** A task is given a **location + radius** and an
**active-from date** (optional active-until). On/after that date, when the **assigned** worker's phone
**dwells ~3 minutes** inside the radius, the phone fires a **grouped** local notification: *"You have N
things to do here."* They open the task(s), do the work, **capture photos**, mark done; it syncs back.
- The geofence is evaluated **on-device**, works **fully offline**, and **re-alerts on every re-entry**
  (no quiet-hours in v1). Presence-only — **no location history is stored**.
- *Edge:* GPS denied/unavailable → the app degrades gracefully (manual task list still works), never
  crashes, and surfaces a permission prompt.
- *Edge:* task not assigned to this worker, or today is before active-from → **no alert**.

**3 — Apply for leave.** Staff submit a leave request (type, dates, optional reason) → an approver
(anyone with `approve_leave`) approves/rejects → requester is notified → approved leave appears on the
**activity calendar** and marks the person **unavailable** for assignment.
- *Edge:* insufficient balance → warn/block at submit.
- *Edge:* overlapping request → flag the conflict.
- *Edge:* the only approver is themselves on leave → route to Owner/Admin.

**4 — Drag-and-drop document filing.** User drops a pile of files → OCR (L1) → **match extracted
IDs/names against the app's own records** (L2: PO/invoice numbers, client/supplier names, dates) →
auto-file into **Client › Project › category** when confident → everything uncertain lands in a
**review tray** for one-click confirmation; each correction trains **per-supplier** matching.
- *Confidence-gated — never silent for financial documents.* High confidence auto-files; low confidence
  → review tray; no match → unsorted.
- *Edge:* a **payslip** is detected → filed as **SPI** (encrypted, finance-permission-gated, excluded
  from broad search), never auto-shared.

**5 — File sync.** A user's project folders sync two-way with the server (Nextcloud engine, D-10),
with revision history; files attach as shortcuts to a project/task/invoice/expense.
- *Edge:* concurrent edits → both kept as revisions, newest surfaced.
- *Edge:* a **read-only** user edits a synced file locally → the **server rejects** the change (the
  authorisation boundary is server-side).

**6 — Milestone sign-off (v2, client).** A client opens their read-only project view → reviews a
completed milestone + its photos → **signs off or rejects** → the PM is notified.

---

## Data Sensitivity

- **PII** — client and staff names, contacts, addresses, assignments.
- **SPI (Sensitive Personal Information, PH DPA)** — **payroll documents/payslips** stored & OCR'd by
  the document filer; **sick-leave** context. Encrypted at rest, finance/HR-permission-gated, excluded
  from broad search. The app **computes no payroll** — it only stores such documents.
- **Financial** — invoices, POs, expenses, inventory value (v2).
- **Location / presence** — task locations and "worker arrived at task" events. **Presence-only; no
  continuous tracking or location history.**
- **Photos** — site photos carrying GPS/EXIF.

---

## Compliance & Data Privacy

- **Regime:** PH Data Privacy Act (RA 10173) baseline. Shipped globally as OSS; installing firms in
  other regions layer their own obligations.
- **Controller:** the **installing firm** is the data controller — **not Powerbyte**. The product's job
  is to **provide the mechanisms** for compliance, not to act as controller.
- **DPA mechanisms — built into v1:** configurable **retention periods**, **export-my-data** and
  **delete-my-data** actions for data-subject requests, and an **access audit log** (who viewed/
  downloaded what).
- **DPO:** a configuration field the installing firm fills in ("to be appointed" acceptable at setup).
- **gov_lgu_flag:** `false` at product level (generic product). **WCAG 2.2 AA is a build target**
  regardless — good practice for public OSS and for firms that serve government clients.
- **SPI handling:** heightened protection as above; leave *reason* is optional and must not require
  health detail.

---

## Conditional Features

- **File Uploads:** yes — documents, drawings, site photos. Storage via MinIO → S3-compatible; on a
  NAS-backed install, MinIO runs on the host over an NFS mount (R-2), with a local-disk fallback; same
  code path either way.
- **Background Jobs (Valkey + BullMQ):** OCR + document matching, file-sync orchestration, notification
  dispatch, scheduled reminders, progress roll-ups.
- **Realtime:** **web = real-time** (kanban board + notifications update live via websocket);
  **mobile = offline-first, sync-on-reconnect.**
- **Reporting / Dashboards:** home dashboard — active projects with % progress · my tasks due/overdue ·
  recent site photos · unsorted-documents count · pending leave approvals (for approvers) · finance
  strip (v2). Charts via shadcn Chart (Recharts).
- **Mobile App (Expo, native):** Android + iOS, **sideload/self-build** (D-6), **offline-first**.
  Carries tasks, activity calendar, assignments, **photo capture** against tasks/milestones, Gantt
  viewing, and the **on-device geofence engine**. Persistent auth (stays logged in; works offline after
  session expiry for read + queued writes). **Push:** geofence + reminders are on-device; server
  notifications arrive via websocket when open and sync on reconnect. Background push (UnifiedPush/APNs)
  is a **v1.x** add-on.
  - **Geofence capability — verified (context7, Expo current SDK, 2026-09-08; `docs/planning/R6`):**
    background Enter/Exit wake-ups work on **iOS + Android** via `Location.startGeofencingAsync` bound to
    a `TaskManager.defineTask` background task — **native build only** (never Expo Go, never PWA),
    confirming the native app is the mandatory geofence carrier. **iOS caps monitoring at 20 regions**
    (Android 100) → the app registers the ≤20 nearest active tasks and re-arms as the worker moves
    (Phase-3 design item). Requires iOS **"Always"** location + `UIBackgroundModes:[location]`; Android
    background-location + foreground-service. The OS fires **Enter/Exit only — no native "dwell" event**,
    so the ~3-minute dwell rule is app-side (timer on Enter, cancel on Exit). Terminated-app relaunch:
    iOS *may* relaunch on an event; Android generally does not — reflected in reliability messaging.
- **Desktop App (Tauri, client-only):** Windows + macOS thin client (D-7, D-11). Syncs via a supervised
  headless-Nextcloud sidecar (D-14 — **resolved (`docs/planning/R8`)**: `nextcloudcmd` is one-shot, so the
  Rust sidecar drives continuous sync via a debounced filesystem-watch + periodic timer, serialized per
  project folder; WebDAV-in-client stays the fallback behind a `FileSyncProvider` port). One app; ~50–300
  lines of Rust for sidecar supervision are the sole non-TypeScript code.
- **Maps:** Leaflet + OpenStreetMap — set a task's location + radius, view sites. No API keys,
  self-hostable tiles.

---

## Infrastructure Notes

- **Install form:** Docker Compose bundle, desktop-as-server, single machine (D-3). Services: Next.js
  app, Postgres, Valkey, BullMQ worker, MinIO, Nextcloud, OCR sidecar (black-box container), optional
  Ollama (document-AI v1.x/v2).
- **Deployment mode:** **LAN-first, no domain required for v1.** Remote access is an **optional add-on**
  (D-15): Pangolin CE reverse tunnel on a **dedicated** small VPS (never the firm's app box), with
  mandatory throughput tuning (Newt ≥1.16.0 + `USE_NATIVE_MAIN_INTERFACE=true` + host networking); the
  no-VPS fallback is Traefik + Let's Encrypt + port-forward where a routable IP exists.
- **External services:** none required. Optional, off by default: **bring-your-own LLM API key** for
  higher document-AI accuracy (D-16), and the remote-access VPS.
- **Language:** TypeScript across web, desktop and mobile; frameworks differ per platform (D-8).
  Third-party engines (Nextcloud, OCR, Ollama) are wrapped as black-box sidecars, never modified.
- **Dev environment:** WSL2 native. Ports auto-assigned in Phase 3. **HARD HOLD — local only.**

---

## Environments Needed

- **dev** — local (WSL2), the only environment active now (HARD HOLD).
- The product itself **ships as a Compose bundle** to installing firms, who run their own single
  environment. No Powerbyte staging/prod for this app unless the owner explicitly opens it.

---

## Modules & Features — phasing

**v1 (build first)**
- Project management — kanban, todos, assignment, scheduling, Gantt, per-project shortcuts.
- File management — Nextcloud two-way sync + revisions; attach to project/task.
- Document-AI **thin slice** — drag-drop → OCR → exact-ID auto-file → review tray (no LLM).
- Notifications — assignment/due/mention/status **+ geofenced task alerts** (the differentiator).
- **Leave management** — apply / approve (`approve_leave` permission) / balances / leave calendar.
- Mobile app (Expo) + Desktop client (Tauri).
- DPA mechanisms — retention, export/delete, access audit log.
- RBAC with custom groups + per-user overrides (permission builder).

**v2 (planned)**
- Invoicing (standalone) · Purchase orders → inventory · Company expenses · Inventory with full chain
  of custody · **Client portal** (read-only + milestone sign-off).
- Document-AI **full** — local LLM (L3) + per-supplier template learning.

**v1.x**
- Background mobile push (UnifiedPush + APNs) · native desktop **server** installer.

---

## Design Identity

- **Look & feel:** **simple, uncluttered, user-friendly, common modern interface.** Clean lines,
  generous whitespace, glanceable. Nothing baroque — a tool site staff and office staff both find
  obvious on first use.
- **Visual reference:** Kaneo (interaction patterns, board/detail layout, information architecture).
- **Component system:** shadcn/ui + Tailwind (D-1), with Kibo UI registry for kanban / Gantt / dropzone.
- **Typography:** IBM Plex Sans (UI/body) + JetBrains Mono (figures/mono) — fleet default.
- **Palette:** calm, professional, construction-appropriate — neutral base + a single confident accent
  (finalised in `docs/DESIGN.md`).
- **Responsive posture:** field-facing pages (tasks, geofence, photo capture, leave apply) are
  **Mobile First**; admin/ops pages (projects admin, users, roles, finance, reports) are **Mobile
  Ready** (desktop-primary, scales down). Full per-page table generated in DESIGN.md.

---

## Out of Scope

**v1 exclusions:** attendance/timekeeping · payroll processing/payslip generation (documents stored as
SPI only, no computation) · full accounting/general ledger/tax filing · BIM/CAD viewing or editing ·
multi-company/tenancy · worker location tracking/history (presence-only) · feature parity with
commercial Orqafy · store-published mobile apps.

**Deferred to v2:** finance modules (invoicing/PO/inventory/expenses) · client portal · document-AI LLM
layer + per-supplier learning.

---

## Commercial Model (post-v1)

The app itself is **free and open-source (AGPL-3.0), self-hosted** — no licence fee, no per-seat cost. The
**only** paid offering is an **optional cloud-hosted storage add-on** (D-27): a firm that would rather not
self-host its files subscribes to store its assets in Powerbyte's cloud, on a **monthly tier by storage
size**.

- **Backend: Cloudflare R2** — chosen over AWS S3, decisively cheaper for this egress-heavy workload (R2
  charges **$0 egress**; S3's ~$0.09/GB egress dominates the bill for a firm repeatedly viewing/downloading
  photos + drawings). Full analysis: `docs/planning/R9_CLOUD_STORAGE_PRICING.md`. The existing MinIO→S3
  storage abstraction (R-2) makes the cloud backend the **same code path**.
- **Tiers (USD/mo, ratified 2026-09-08):** Starter 25 GB $3 · Team 100 GB $6 · Business 250 GB $12 ·
  Pro 500 GB $19 · Scale 1 TB $35 · Max 2 TB $60. **Unlimited viewing/downloads** (R2 egress is free);
  gross margins 49–93%, covering the VPS + net profit.
- **Boundary:** billing + subscription live on **Powerbyte's hosted control plane, NOT inside the
  open-source app** — the app merely points its storage backend at the subscriber's cloud bucket. The
  shipped product stays genuinely free/OSS with no payment gateway baked in (`inputs.yml` payment/docker
  stay `none`).
- **Timing: post-v1.** v1 ships the free self-hosted app; the storage subscription + billing control plane
  is a later monetization track.

**Deferred to v1.x:** background mobile push · native desktop server installer.
