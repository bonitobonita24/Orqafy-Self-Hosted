# DESIGN.md — Orqafy-Self-Hosted

> Design system + tokens. Derives from `docs/PRODUCT.md` (approved 2026-09-06) and D-23.
> Direction: **simple, uncluttered, user-friendly, common modern interface.** Kaneo as the visual /
> interaction reference; shadcn/ui as the component system. This defines the tokens the Phase 2.8
> mockup and Phase 4 build consume.

---

## 1. Design principles

1. **Glanceable over dense.** Site staff read this on a phone in daylight; office staff scan it between
   tasks. Whitespace and clear hierarchy beat cramming.
2. **One obvious action per screen.** Primary action is always visually singular. No competing CTAs.
3. **Familiar, not clever.** Standard patterns (top nav, sidebar, cards, tables) so first use needs no
   learning. Kaneo's calm board/detail rhythm is the reference.
4. **Field-first where it's field work.** Task, geofence, photo-capture and leave-apply screens are
   designed for thumb reach and big touch targets first, desktop second.
5. **Quiet by default, loud only for the differentiator.** The geofence "you have something to do here"
   moment is the one place we allow an assertive, unmistakable treatment.

---

## 2. Color tokens (shadcn/ui CSS-variable model)

Neutral **slate** base + a single confident **blueprint-blue** primary (engineering/trust association),
with **amber** reserved narrowly for the location/geofence accent so "you're on site" reads instantly.
Values are HSL. Both themes defined; the app defaults to light, dark available.

**Light**
```
--background:        222 20% 99%      --foreground:        222 47% 11%
--card:              0 0% 100%         --card-foreground:   222 47% 11%
--muted:             215 28% 95%       --muted-foreground:  215 16% 42%
--border:            215 20% 88%       --input:             215 20% 88%
--primary:           215 70% 42%       --primary-foreground:210 40% 98%   /* blueprint blue */
--accent:            38 92% 50%        --accent-foreground: 222 47% 11%    /* geofence amber */
--destructive:       0 72% 51%         --destructive-foreground: 0 0% 100%
--success:           142 60% 38%       --warning: 38 92% 50%
--ring:              215 70% 42%
```

**Dark**
```
--background:        222 30% 9%        --foreground:        210 40% 96%
--card:              222 26% 12%       --card-foreground:   210 40% 96%
--muted:             217 25% 18%       --muted-foreground:  215 20% 65%
--border:            217 25% 20%       --input:             217 25% 22%
--primary:           215 75% 60%       --primary-foreground:222 47% 11%
--accent:            38 92% 55%        --accent-foreground: 222 47% 11%
--destructive:       0 63% 50%         --destructive-foreground: 0 0% 100%
--success:           142 55% 48%
--ring:              215 75% 60%
```

**Semantic status colors** (task/project/leave states, consistent everywhere):
`todo` = muted · `in-progress` = primary · `blocked` = destructive · `done` = success ·
`pending` (leave/review) = warning/amber · `approved` = success · `rejected` = destructive.

Radius: `--radius: 0.625rem` (rounded-lg default). Elevation: shadcn `shadow-sm` on cards; no heavy
drop-shadows.

---

## 3. Typography

- **UI / body:** **IBM Plex Sans** (self-hosted via next/font) — fleet default.
- **Figures / mono / codes** (project codes, PO/invoice numbers, coordinates): **JetBrains Mono**.
- **Fallback stack:** `"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif`.
- Scale: body `text-sm` (14px) default · labels `text-sm font-medium` · captions `text-xs
  text-muted-foreground` · headings `text-lg`→`text-2xl font-semibold` · page titles `text-2xl`.

---

## 4. Layout & components

- **App shell:** top bar (`h-14`, org name + global search + notifications + avatar) with a **left
  sidebar** nav on desktop that collapses to a bottom tab bar on mobile. Content `max-w-7xl mx-auto
  px-4 sm:px-6 lg:px-8` — always guttered, never edge-to-edge.
- **Cards:** `rounded-lg border bg-card shadow-sm`, `p-6` header / `p-6 pt-0` content.
- **Kanban board / Gantt / file dropzone:** **Kibo UI** registry components, themed to these tokens.
- **Charts:** shadcn Chart (Recharts) — progress bars and simple bar/line only; no 3D or gratuitous viz.
- **Maps:** Leaflet + OpenStreetMap; task location shown as a pin + a translucent radius circle in
  `--accent` amber.
- **Tables:** filter bar + sortable columns + pagination; `hover:bg-muted/50` rows.
- **Forms:** single column, `max-w-2xl`, stacked label+input, primary submit bottom-right.
- **Icons:** lucide-react only.
- **Badges:** rounded-full, the semantic status colors above.

---

## 5. The geofence moment (the one assertive treatment)

When a geofenced alert fires: a full-width amber-accented banner/sheet — large title *"You have N
things to do here"*, the site name, and the task list as big tappable rows with a camera shortcut.
This is the only screen that deliberately breaks the "quiet" rule. Everywhere else, notifications are
standard toasts / a notification center.

---

## 6. Per-page mobile classification (Phase 4 layout input)

| Page / screen | Class | Why |
|---|---|---|
| Login / first-run setup | Mobile Ready | Setup is desk work |
| Dashboard (home) | Mobile Ready | Owner/PM overview, desktop-primary |
| Projects list / project admin | Mobile Ready | Ops/admin |
| Project board (kanban) | Mobile Ready | Usable on phone, primary on desktop |
| Project detail / Gantt | Mobile Ready | Planning is desktop work; Gantt view-only on mobile |
| **My Tasks** | **Mobile First** | Field staff primary surface |
| **Geofence alert** | **Mobile First** | On-device, on-site, phone-only in practice |
| **Photo capture** | **Mobile First** | Camera, on site |
| **Apply for leave** | **Mobile First** | Staff self-service from phone |
| Leave approvals | Mobile Ready | Approver, often at desk |
| Activity calendar | Mobile Ready | Scales down |
| Files / document filing (drag-drop) | Mobile Ready | Bulk drop is desktop; mobile = browse/upload |
| Document review tray | Mobile Ready | Triage, desktop-primary |
| Clients | Mobile Ready | Admin |
| Notifications center | Mobile First | Checked on phone |
| Settings / Users / Roles (permission builder) | Mobile Ready | Admin config |
| Map / sites | Mobile Ready | Both, desktop-primary for planning |
| Client portal (v2) | Mobile First | External, often on phone |

---

## 7. What the Phase 2.8 mockup must show

Realistic **Philippine construction-firm** data (real-sounding client/company names, project codes like
`PRJ-2026-014`, peso amounts, Calapan/Oriental Mindoro place names for sites) — never Lorem ipsum.
Screens to render: Dashboard, Projects list, Project board (kanban), Task detail (with location +
geofence schedule), My Tasks (mobile), Geofence alert (mobile), Files + review tray, Apply-for-leave +
Leave approvals, Users/Roles permission builder. Each component tagged with its
`data-loading-path` (shadcn vs custom) per the framework's Phase 4 Part 5 contract.

---

## 8. Offline-first mobile behaviour (D-15)

A v1 commitment, not a retrofit. The Expo app is usable on a construction site with no connectivity;
the server is a sync target, never a hard dependency for field work. Verified geofence facts:
`docs/planning/R6_EXPO_GEOFENCING.md`.

- **Cached read model.** On login/sync the app caches the worker's assigned tasks, their
  location+radius+schedule, the activity calendar, and recent project context into local storage
  (SQLite/MMKV). My Tasks, Gantt-view, and the geofence set render from cache with zero network.
- **Local geofence engine (no server contact).** Geofence Enter/Exit is evaluated entirely by the OS
  location subsystem against the cached region set; the ~3-minute dwell timer and the local
  notification fire on-device. A worker who has synced once needs **no signal** for the differentiator
  to work. (iOS 20-region cap → cache-driven re-arming of the nearest active tasks, per R6.)
- **Outbound queue (durable, ordered).** Task status changes, photo captures, and leave applications
  are written to a local append-only outbound queue with a stable client-generated id + `createdAt`,
  then drained to the server on reconnect (BullMQ-side idempotency by client id). Photos stage as local
  files; upload is a queued job with retry/backoff — the worker never waits on the network to record
  evidence.
- **Conflict handling on reconnect.** Last-writer-wins per field using `updatedAt`, EXCEPT task
  completion, which is monotonic (once done, a stale "in-progress" never un-completes it). Photo
  uploads never conflict (append-only). A field surfaces a soft "updated on server since you edited"
  note rather than silently clobbering. Deletes use tombstones (no silent resurrection on next sync).
- **Sync trigger.** On app foreground, on connectivity regain, and on a periodic timer; the websocket
  channel (when the app is open and online) delivers live server notifications on top.

## 9. Desktop packaging &amp; the Rust sidecar surface (D-11, D-14)

Desktop shell is **Tauri v2**. Full research: `docs/planning/R7_DESKTOP_PACKAGING.md` (signing/updater) and
`docs/planning/R8_NEXTCLOUD_SYNC.md` (sync cadence).

- **Signing (per platform):** macOS — Developer ID + `codesign` (hardened runtime, inside-out incl. the
  sidecar) + notarization/stapling via notarytool. Windows — Authenticode (SignTool thumbprint or a
  `signCommand`; Azure Trusted Signing / EV-cert options). Linux AppImage — optional GPG signature (no
  OS gatekeeper enforces it; the updater's minisign signature is the load-bearing integrity check).
- **Auto-update:** Tauri updater plugin, **static-JSON manifest served from our OWN domain** (AGPL, no
  app store — D-2). `createUpdaterArtifacts:true` emits installer + `.sig`; the client verifies a
  **minisign** signature against `pubkey` before installing, so a tampered artifact is rejected even off
  an untrusted mirror. The updater private key lives in the **Server-Setups vault**; losing it = no
  further updates to installed clients.
- **Rust sidecar (sole non-TypeScript code — D-11):** bundled via `externalBin` + a `shell:allow-execute`
  sidecar capability; spawned/supervised from Rust (`ShellExt::sidecar`). Its 7-point surface: (1) launch
  the file-sync sidecar (headless `nextcloudcmd`, D-14); (2) own its lifecycle (kill on app exit);
  (3) watch its `CommandEvent` stream; (4) restart-on-crash with capped backoff; (5) **drive the sync
  cadence** — because `nextcloudcmd` is one-shot (R8), the sidecar triggers runs on a debounced
  filesystem-watch + periodic timer, serialized behind a per-project-folder lock; (6) relay status to the
  TS UI; (7) pass only validated args. Status-relay + scheduling only — **no sync/domain logic in Rust**
  (that would be the D-11 signal to revisit Tauri). WebDAV-in-client stays the fallback behind a
  `FileSyncProvider` port.
