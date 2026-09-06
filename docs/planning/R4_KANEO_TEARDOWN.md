# R-4 · Kaneo Teardown — domain ideas & interaction patterns for Orqafy-Self-Hosted

> **Scope:** ideas + UI/UX patterns only. **D-1 is locked** — we build on the AIEF stack
> (Next.js · tRPC · Prisma · Auth.js v5 · Postgres · Valkey · BullMQ · MinIO/S3 · shadcn/ui).
> Kaneo's Hono + Drizzle + Better-Auth backend is **not adopted** and nothing below recommends adopting it.
>
> **Source read:** `https://github.com/usekaneo/kaneo` @ `42bb801114aa1ae499228a53180f0cdbc5607964`
> (2026-09-05), package version **2.22.0**, MIT © 2024 Andrej Acevski (`LICENSE`).
> Cloned to a scratch dir and read from source — not from the README.
> **Author:** research agent, 2026-09-06. HARD HOLD: local only, no code lifted yet.

---

## 0. What Kaneo actually is (calibration)

| Fact | Evidence |
|---|---|
| Monorepo: `apps/api` (Hono), `apps/web` (React 19 + Vite), `apps/site` (Next.js marketing), `apps/docs`, `packages/{libs,email,mcp,permissions,planka-import}` | `pnpm-workspace.yaml`, `AGENTS.md` §Architecture |
| Frontend stack: React 19 · TanStack Router + Query · Tailwind **v4** · **Base UI + Radix mix** · dnd-kit · TipTap 3 · framer-motion · cmdk · sonner · zustand · react-hook-form + zod · i18next (20 locales) | `apps/web/package.json`, `i18n/` |
| Backend: Hono + Drizzle/Postgres + Better-Auth, in-process `EventEmitter` bus, WebSockets with optional Redis fan-out, S3-compatible asset storage | `apps/api/src/{events,ws,storage}` |
| Product surface: workspaces → projects → columns → tasks, plus **board / list / backlog / calendar / gantt** views, subtasks, task relations, labels, comments, activity feed, time entries, notifications (email/ntfy/gotify/webhook), GitHub/Gitea/Slack/Discord/Telegram integrations, MCP server, public project sharing, Helm chart, billing (Creem) | `apps/web/src/routes/**`, `apps/api/src/**` |
| It is a **commercial-open-source** product (paid tiers, seats, trials) — `workspace_billing`, `trial_grant`, `billing_event` tables exist. Roughly a third of the API surface is billing/integration plumbing we will never need. | `apps/api/src/database/schema.ts`, `apps/api/src/billing/` |

**Calibration vs the seed brief's "~15–20% of scope":** accurate on *breadth*, slightly pessimistic on
*PM depth*. Kaneo already ships Gantt, calendar, backlog, subtasks, task relations and a genuinely good
notification-preference engine — more PM surface than the brief credits it with. It still has **zero**
of the construction-specific product (geofencing, clients, revisions, photo capture, inventory).

---

## 1. Data model

### 1.1 Entity table (as implemented)

Extracted from `apps/api/src/database/schema.ts` (1179 lines) + `relations.ts`. All ids are `cuid2` text.

| Entity (table) | Key columns | FKs / relationships | Notes |
|---|---|---|---|
| `user` | name, email, emailVerified, image, locale, role, banned/banReason/banExpires, isAnonymous | — | Better-Auth shape; `isAnonymous` powers demo mode |
| `session`, `account`, `verification`, `apikey`, `device_code`, `mcp_oauth_state` | Better-Auth standard | → user | Pure auth plumbing. **Replaced wholesale by Auth.js v5.** |
| `user_avatar` | mimeType, size, `data bytea` | → user | Avatar bytes **in Postgres**, not object storage. Odd split from `asset`. |
| `workspace` | name, slug, logo, description, metadata | — | The tenant root. No owner FK — ownership lives in `workspace_member.role` |
| `workspace_member` | role, joinedAt | → workspace, user | The tenancy join table |
| `team` / `team_member` | name | → workspace / → team, user | Sub-grouping inside a workspace; lightly used |
| `invitation` | email, role, teamId, status, expiresAt, inviterId | → workspace, user | Email-invite flow with expiry |
| `workspace_role` | role (name), `permission jsonb` | → workspace | **Data-driven custom roles** — permissions stored as JSON per workspace |
| `workspace_billing`, `trial_grant`, `billing_event` | plan, seats, period, Creem ids | → workspace | COSS monetisation. **Drop entirely.** |
| `project` | slug, icon, name, description, isPublic, archivedAt, `lastTaskNumber`, position | → workspace | `lastTaskNumber` drives human keys (`ENG-42`); `isPublic` = read-only share link |
| `column` | name, slug, position, icon, color, **isFinal** | → project | Board columns are **per project and user-defined**; `isFinal` marks "counts as done" |
| `task` | number, title, description (markdown), **status** (string), columnId, priority, startDate, dueDate, position, userId (assignee) | → project, column, user | See critique — `status` and `columnId` are redundant |
| `task_relation` | relationType | → task (source), → task (target) | blocks / relates-to / duplicates style graph |
| `label` | name, color, taskId, workspaceId | → task, workspace | **Denormalised**: a label row is per-task, not a many-to-many |
| `comment` | content | → task, user | |
| `activity` | type, content, `eventData jsonb`, external{UserName,Avatar,Source,Url} | → task, user | Unified audit + comment stream; the `external*` columns let a GitHub event render as an actor |
| `asset` | objectKey (unique), filename, mimeType, size, **kind**, **surface**, createdBy | → workspace, project, task, activity | S3 object metadata. `kind`/`surface` discriminate image vs file, description vs comment |
| `time_entry` | description, startTime, endTime, duration | → task, user | Manual + timer time tracking |
| `notification` | title, content, type, `eventData jsonb`, isRead, resourceId/resourceType | → user | In-app inbox, polymorphic resource pointer |
| `user_notification_preference` | per-channel toggles + ntfy/gotify/webhook creds + `dueDateReminderLeadTimeMinutes` | → user | Global per-user channel config |
| `user_notification_workspace_rule` | isActive, per-channel toggles, `projectMode` | → user, workspace | Per-workspace override of the global prefs |
| `user_notification_workspace_project` | — | → workspace, rule | Project allow/deny list for the rule above |
| `task_reminder_sent`, `billing_reminder_sent` | reminderType | → task/user | Idempotency ledger so a reminder fires once |
| `job_lease` | name, owner, expiresAt | — | Poor-man's leader election for the cron scheduler |
| `integration`, `github_integration`, `external_link`, `workflow_rule`, `generic_webhook`… | type, `config jsonb`, eventType→columnId | → project / task | Issue-tracker plumbing |

### 1.2 Critique — what to mirror, what is wrong for a construction firm

| Kaneo choice | Verdict | What we do |
|---|---|---|
| **`column.isFinal` flag instead of a hardcoded "done" status** | ⭐ **Mirror.** Columns are user-defined, so completion must be a property of the column, not a magic string. Reused everywhere (`due-date-status.ts`, Gantt, stats). | `BoardColumn.isFinal Boolean` in Prisma. Construction stages differ per firm ("For Inspection", "Punchlisted", "Turned Over") — hardcoding `done` would be wrong on day one. |
| **`project.lastTaskNumber` → human key `SLUG-42`** | ⭐ **Mirror.** Site staff will read task numbers over the radio and write them on drawings. A cuid is unusable verbally. | `Project.lastTaskNumber Int` + a transactional increment. Watch the race: Kaneo has a `claim-task-numbers.ts` controller — do it in a Prisma `$transaction` with a row lock. |
| **`workspace_role.permission jsonb` — data-driven custom roles** | ⭐ **Mirror the shape**, not the impl. Fits our 3-tier RBAC standard and lets a firm add "Site Foreman (read + photo only)". | Prisma `Role { permissions Json }` scoped to tenant. Static built-in roles seeded, editable rows override. See `packages/permissions/src/index.ts` for a clean `resource: [actions]` statement vocabulary. |
| **Per-user + per-workspace + per-project notification rule cascade** | ⭐ **Mirror the cascade.** Three-level override (global → workspace → project allow-list) is exactly what a firm with 8 concurrent sites needs so foremen aren't spammed. | Model it now, before geofencing is added; the geofence channel becomes a fourth toggle in the same cascade. |
| **`activity` as a unified audit + external-actor stream** | ⭐ **Mirror.** `eventData jsonb` + `external*` columns render heterogeneous events in one feed cheaply. | Our chain-of-custody (v2) and photo-capture events plug straight into this shape. |
| **`asset` with `kind` + `surface` discriminators and a unique `objectKey`** | ✅ **Mirror the metadata row**, drop `user_avatar bytea`. | One `Asset` table for MinIO/S3 objects. But see §2 — we need **revisions**, which they have no concept of. |
| **`task.status` (string) *and* `task.columnId` both present** | ❌ **Do not copy.** Two sources of truth for the same fact; `isTaskCompleted()` has to defensively fall back to slug matching when columns haven't loaded. | One FK: `Task.columnId`. Derive status from the column. |
| **`label` is a per-task row (`label.taskId`), not a join to a shared label** | ❌ **Wrong.** Renaming or recolouring a label means updating N rows; there is no canonical label list per workspace. | Proper `Label` + `TaskLabel` many-to-many, tenant-scoped. |
| **`task.position` is an `integer`, recomputed client-side and PUT back** | ❌ **Wrong at scale / offline.** Two people dragging on the same board race; a stale offline client overwrites the order. (`update-task.ts` takes `position: number`; the client recomputes with immer in `kanban-board/index.tsx`.) | Use a **fractional/lexicographic rank** (`Decimal` or a LexoRank string). Non-negotiable for us: site staff go offline and resync. |
| **Assignee is a single `task.userId`** | ❌ **Thin for construction.** A pour or an inspection involves a crew, plus a responsible engineer. | `TaskAssignee` many-to-many with a `role` (responsible / crew / watcher). |
| **No client/customer entity at all** | ❌ **Missing.** Kaneo's root is `workspace` → `project`; there is nothing between. | See §2. |
| **`user_avatar` stores image bytes in Postgres** | ❌ Anti-pattern; bloats the DB and backups. | All binaries → MinIO/S3 behind our storage abstraction (R-2). |
| **Workspace = tenant, hard-coded 1 level** | ⚠️ Adequate but flat. Our brief is "multiple projects per client", and a firm may run several legal entities. | Keep `Tenant`(workspace) as the RBAC root, insert `Client` beneath it, `Project` beneath that. |
| **Billing / seats / trials / COSS plumbing** | ❌ **Delete.** AGPL-3.0, self-hosted, no seats. | Ignore ~5 tables and the whole `apps/api/src/billing` tree. |

---

## 2. What our domain needs that Kaneo has no concept of

Legend: **EXTEND** = their table takes new columns/tables cleanly · **REPLACE** = their model is the
wrong shape · **NET-NEW** = no analogue exists.

| Our requirement (SEED_BRIEF §3) | Kaneo analogue | Verdict | Shape we need |
|---|---|---|---|
| **Task location + radius (geofence)** — *the differentiator* | none | **EXTEND `task`** | `TaskLocation { taskId, lat, lng, radiusM, label, geofenceActive, activeFrom/Until }` — separate table, not columns, because a task can have >1 site point (staging area + pour location) and because geofence registration limits (iOS ≈20 regions) force server-side *selection* of the nearest-N regions per device. Also needs `DeviceGeofenceRegistration { userId, deviceId, taskLocationId, registeredAt }` and `GeofenceEvent { userId, taskLocationId, enteredAt, exitedAt, accuracyM, source }` — the audit trail is what makes "you were on site" defensible. Kaneo's PostGIS-free schema is fine: `Decimal` lat/lng + a bounding-box prefilter covers a firm with hundreds of sites; PostGIS only if we later do polygons. **Unverified:** Expo background-location region limits — confirm via `context7` per brief constraint 1. |
| **Scheduling / Gantt** | ⭐ **has it** — `task.startDate` + `task.dueDate`, rendered by `routes/…/gantt.tsx` | **EXTEND** | Their Gantt is a *presentation* of two dates: no dependencies, no critical path, no baseline, no calendar/working-days, no resource levelling. `task_relation` exists but is **not** wired into the Gantt. For construction we need: `TaskDependency { predecessorId, successorId, type: FS/SS/FF/SF, lagDays }` (upgrade their `task_relation`), `Task.baselineStart/baselineEnd` (variance vs plan is the whole point of a programme), `Task.durationDays` + `progressPercent`, a `WorkCalendar` (Sundays, holidays, rain days). Milestones = zero-duration tasks with a flag. |
| **Clients as first-class records** | none | **NET-NEW** | `Client { tenantId, name, contactName, email, phone, address, tin, notes }` with `Project.clientId`. Everything in v2 (invoices, project expenses) hangs off it. Insert it in the hierarchy **now** — retrofitting a level above `project` after data exists is painful. |
| **File attachments with revisions** | `asset` (flat, immutable, one row per object) | **REPLACE** | Architects revise drawings constantly. `Document { id, projectId, clientId?, folderPath, name, currentRevisionId }` + `DocumentRevision { documentId, rev (A/B/C or 1,2,3), objectKey, size, mimeType, uploadedBy, uploadedAt, supersededAt, checksum }`. Kaneo's `asset.objectKey unique` + `kind`/`surface` discriminators are a good *revision-row* shape — keep them, add the parent. Ties into R-3 (Syncthing) — the sync agent produces revisions; the app indexes them. |
| **Photo capture against tasks and milestones** | `asset` can hold an image on a task | **EXTEND** | Site photos are evidence, not attachments. Need `Photo` (or `Asset` + columns): `capturedAt`, `lat/lng/accuracy` (EXIF or device), `capturedBy`, `taskId?`, `milestoneId?`, `caption`, `beforeAfter` tag, and a server-side thumbnail derivative. Must survive an offline queue (photo taken in a basement, uploaded at the gate). Kaneo uploads synchronously (`lib/upload-task-image.ts`) — no queue, no retry. |
| **Chain-of-custody inventory (v2)** | none | **NET-NEW** | Append-only ledger, not a mutable stock count: `InventoryItem`, `StockMovement { itemId, qty, unit, type: PURCHASED/RECEIVED/RELEASED/RETURNED/SOLD/ADJUSTED, sourceRef (PO), destRef (project|invoice), byUser, at, note }`, balance = a materialised view or a running sum. Kaneo has nothing remotely like this. |
| **Invoicing / POs / expenses (v2)** | none | **NET-NEW** | Standalone of `project` per brief §3(b); joined via `clientId`. |
| **Two-way file sync (Syncthing)** | none | **NET-NEW** | R-3. Kaneo contributes nothing. |
| **Offline-tolerant mobile** | none — TanStack Query with no persister; only *error classification* for offline (`query-client/index.ts`) | **NET-NEW** | Needs a mutation outbox + a persisted query cache. Their code explicitly tolerates offline errors without crashing (worth copying the *classifier*), but has no offline capability. |
| **Multi-assignee crews, trades/disciplines** | single `task.userId` | **REPLACE** | `TaskAssignee` M2M + a `Discipline`/`Trade` taxonomy (civil, structural, MEP, architectural) — labels alone will not carry it. |
| **Weather / site conditions on a daily log** | none | **NET-NEW (v1.5)** | Worth flagging now; a daily site report is the single most-requested construction PM artefact after the programme. |

---

## 3. UI/UX patterns worth carrying

The owner likes this UI, and it is genuinely good. **The good news for D-1:** Kaneo's design system is
Tailwind **v4** with the **shadcn CSS-variable token vocabulary** (`--background`, `--foreground`,
`--muted`, `--sidebar-*`, `--chart-1..5`, plus their own `--success`/`--warning`/`--info`) — see
`apps/web/src/index.css`. Our shadcn/ui stack consumes the *same* token names, so the visual language
transfers almost 1:1 even though the component primitives differ (they run Base UI + Radix; we run
shadcn/Radix). Their typeface is Geist/Geist-Mono; ours is fleet-standard **IBM Plex Sans / JetBrains Mono**.

### 3.1 Screen-by-screen

| Screen / pattern | What they do (file) | Carry? | Construction-site adaptation |
|---|---|---|---|
| **App shell** | Collapsible sidebar (`components/ui/sidebar.tsx`), workspace switcher at top (`workspace-switcher.tsx`), "Overview" group (Projects/Members/Invitations) + a projects tree (`nav-main.tsx`, `nav-projects.tsx`), breadcrumb selects in the header (`common/header/*-crumb-select.tsx`) | ✅ **Reproduce** | Breadcrumb **selects** (not static crumbs) are the standout — every crumb is a dropdown that switches sibling entity. Ours: Client › Project › View. On phone the crumb select becomes the primary navigation. |
| **View switcher: Board / List / Backlog / Calendar / Gantt** | Five sibling routes under `…/project/$projectId/`, toolbar switch (`components/board/board-toolbar.tsx`), phone version collapses into a popover with a 4-up icon grid (`common/header/mobile-project-nav.tsx`) | ✅ **Reproduce the concept**, improve the phone version | The 4-up popover grid is a compromise. For site users make it a **persistent bottom tab bar** (thumb-reachable, ≥48px targets) — a hidden menu behind a hamburger is the wrong affordance in gloves. |
| **Kanban board** | dnd-kit with **three sensors** — Mouse (8px activation distance), **Touch (250ms delay + 10px tolerance)**, Keyboard; `closestCorners` collision; `DragOverlay` with a 300ms `cubic-bezier(.23,1,.32,1)` drop (`components/kanban-board/index.tsx`) | ✅ **Reproduce the sensor config verbatim** | The touch delay+tolerance combination is the exact tuning that makes a kanban usable on a phone without hijacking scroll. This is a real, hard-won detail — take it. Increase the card min-height and hit area for gloved hands. |
| **Task card** | Compact card: task number, title, priority icon, due-date badge colour-coded by urgency, avatar, labels, subtask progress `3/7`, PR badges. Every element **individually toggleable** via user preferences (`kanban-board/task-card.tsx` + `store/user-preferences.ts`) | ✅ **Reproduce, incl. the toggles** | ⭐ The per-user "show/hide task numbers · assignees · due dates · labels · priority · item counts" + a `compactMode` is the best idea in their UI. Site foremen want 3 fields and big text; the PM wants 8. Ship it. Add a "field size" step (comfortable / large) — not just compact. |
| **Due-date urgency colouring** | `lib/due-date-status.ts` → overdue / due-soon (≤3d) / far-future / none, with token-based colour + icon maps; completion resolved via `column.isFinal` | ✅ **Reproduce (and lift the file — see §4)** | Widen the "due-soon" window to a settable value; construction lead times are days-to-weeks. **Never encode urgency in colour alone** — they already pair each state with a distinct Lucide icon (`calendar-x` / `calendar-clock` / `calendar`), which is the accessible thing to do. Keep that. |
| **Task detail = right-hand Sheet, driven by `?taskId=` search param, with an "expand to full page" button** | `components/task/task-details-sheet.tsx`, escalates via `Maximize2` to `…/task/$taskId` | ⭐ **Reproduce — best interaction in the app** | Keeps board context while editing; deep-linkable; back-button correct; the *same* content component renders in both sheet and page (`task-details-content.tsx` + `task-properties-sidebar.tsx` with a `compact` prop). On phone the sheet must become a **full-height bottom sheet**, not a right rail. |
| **Task properties rail** | Every property is a **popover editor** — status, priority, assignee, labels, due date, start date, move-project (`task/task-*-popover.tsx`), each with its own single-letter shortcut | ✅ **Reproduce** | Popover-per-property beats a modal form: one tap, one decision, instant save. Enlarge popover rows to ≥44px for touch. |
| **Keyboard model** | Two-key **prefix chords**, not raw hotkeys: `p c` new project, `w s` switch workspace, `t c` new task, `v b/c/g/l/k` switch view, `n o` notifications, `/` search, `⌘K` palette, `?` help sheet; `j`/`k`/`Enter` to walk the board (`constants/shortcuts.ts`, `hooks/use-keyboard-shortcuts.ts`, `keyboard-shortcuts-help.tsx`) | ✅ **Reproduce the scheme wholesale** | The prefix-chord vocabulary is well designed and discoverable via `?`. It costs us nothing and desk users (architects on a workstation all day) will feel it immediately. Also `hooks/use-numbered-shortcuts.ts` for 1-9 quick-pick in popovers. |
| **Command palette** | cmdk-based, `⌘K`, cross-entity jump + actions (`components/command-palette/index.tsx`, 349 lines) | ✅ Reproduce (shadcn ships the same `Command` primitive) | Add "find task by number" and "jump to site/location" once geofencing exists. |
| **Empty states** | Dedicated `Empty` primitive with `EmptyHeader` / `EmptyMedia(variant="icon")` / description / action — a framed icon tile with layered inner shadow, centred, max-w-sm (`components/ui/empty.tsx`) | ✅ **Reproduce** | It is a *component*, not ad-hoc markup, so every empty surface looks the same. Ours: same primitive, but every empty state gets a **primary action button** (theirs sometimes doesn't). |
| **Skeletons over spinners** | `task-page-skeleton.tsx`, `ui/loading-skeleton.tsx`, a custom `--animate-skeleton` keyframe | ✅ Reproduce | On a 3G site connection skeletons matter more, not less. |
| **Motion + reduced-motion** | Custom eases `--ease-out: cubic-bezier(.23,1,.32,1)`; a **thorough** `@media (prefers-reduced-motion: reduce)` block that strips movement per `data-slot` while keeping opacity, and neutralises dnd-kit's inline transition via `[data-kaneo-sortable]` (`index.css`) | ⭐ **Reproduce — lift this CSS block** | Genuinely well done and rarely done at all. Cheap accessibility win. |
| **Theme switching** | zustand + `persist`; uses the **View Transitions API** with `--x`/`--y` set from the click coordinates, so the theme wipes out from the toggle (`store/user-preferences.ts`, `lib/get-click-coordinates.ts`) | ✅ Reproduce (fun, ~30 lines) | ⚠️ **Their default theme is `dark`.** For our users **default to light** and add a **high-contrast / outdoor** theme: phone screens in Philippine noon sun need max contrast, large type, and no low-opacity muted text. This is the single biggest deviation we should make from Kaneo's look. |
| **Density** | `compactMode` toggle; sidebar rows `h-8`, `gap-0.5`, `text-[11px]` badges — a dense, Linear-like desk UI | ⚠️ **Reproduce for desktop, invert for mobile** | Their density is tuned for a mouse. Ship a **`density: comfortable \| compact`** preference that our mobile shell forces to `comfortable`, with ≥44–48px touch targets, ≥16px body text, and no `text-[11px]` anywhere on a phone. |
| **Description editor** | TipTap 3 with markdown round-trip (turndown), task-lists, tables, code w/ shiki, image paste-upload, mermaid; subtask progress **parsed out of the markdown checkboxes** (`lib/get-task-item-stats.ts`) plus a real `subtasks` UI | ✅ Reproduce editor; ⚠️ pick one subtask model | They have *both* markdown checkboxes and structured subtasks — confusing. We should pick **structured subtasks** (they need assignees and photos) and treat markdown checkboxes as a nicety. |
| **Realtime** | WebSocket per project + per user, patching the TanStack Query cache (`hooks/use-project-websocket.ts`, `use-user-websocket.ts`) | ✅ Pattern only | Ours: tRPC subscriptions / SSE over Valkey. Their *cache-patching* approach (not refetching) is the right pattern to copy. |
| **Public read-only project share** | `project.isPublic` + `/public-project/$projectId` route | ✅ **Carry — high value for us** | A client-facing read-only programme + photo feed link is a genuine selling point for a construction firm. Cheap: one flag, one route. |
| **Filters & sort** | URL-state filters with label support (`hooks/use-task-filters*.ts`), sort control, bulk selection with a floating `BulkToolbar` and `j/k` focus walking | ✅ Reproduce | Bulk actions matter when a foreman closes 20 punchlist items after a walkthrough. |
| **i18n** | 20 locales, namespaced JSON, `i18next` + a schema (`i18n/schema.json`) | ✅ Reproduce the *structure* | We need EN + Tagalog at minimum for site crews. Their namespacing (`tasks:`, `navigation:`) is a sane convention to copy from day one — retrofitting i18n is expensive. |
| **Onboarding** | `routes/…/onboarding.tsx`, `profile-setup.tsx`, `components/onboarding/` | ✅ Reproduce the flow shape | Self-hosted first-run: create admin → create tenant → create first client/project. |

### 3.2 Where Kaneo's UX is wrong for us (deliberate deviations)

| Their choice | Why it fails on a construction site | Our rule |
|---|---|---|
| Dark default, low-contrast `muted-foreground` for secondary text | Unreadable on a phone in direct sunlight | Light default + an explicit **high-contrast outdoor** theme; minimum 4.5:1 on *all* text incl. muted |
| Dense desktop-first spacing, `text-[11px]` badges, `size-7` icon buttons | Missed taps with gloves/wet hands | Mobile forces comfortable density; ≥44px targets (48px preferred), ≥16px body |
| Hamburger popover for view switching on phone | Hides the primary navigation | Persistent bottom tab bar |
| No offline capability at all | Sites have no signal | Persisted query cache + mutation outbox + explicit "queued / syncing / synced" per-item badges. **Show the user the queue** — silent sync is untrustworthy on site |
| Synchronous image upload | A 6MB site photo on 1 bar fails and loses the photo | Client-side downscale → local persist → background upload with retry; never let a captured photo be lost |
| Hover-dependent affordances (HoverCard previews, context menus) | No hover on touch | Every hover affordance needs a tap/long-press equivalent |
| Board horizontal-scroll of many columns | Awkward one-handed | On phone default to **List/Backlog**, board as opt-in |

---

## 4. Code worth lifting

MIT — lifting is legal **with attribution** (§5). But be honest about the translation cost: **anything
touching Hono, Drizzle, Better-Auth, TanStack Router, or Base UI is a rewrite, not a lift.** That is
~85% of the repo. What survives translation is **pure TypeScript logic, CSS, and constants**.

| File (in Kaneo) | Lines | Why it survives | Effort saved | Take? |
|---|---|---|---|---|
| `apps/web/src/lib/due-date-status.ts` | ~50 | Pure fn + token colour/icon maps. Zero deps. `isTaskCompleted(status, columns)` with the `isFinal` fallback is the non-obvious bit. | ~1h + the design thinking | ⭐ **Lift verbatim** |
| `apps/web/src/lib/task-schedule.ts` (+ `.test.ts`, 121 lines of tests) | ~70 + tests | Pure date normalisation for calendar/Gantt: one-date-is-enough fallback, reversed-range swap, archived exclusion. **Comes with its tests.** | ~3h incl. edge cases | ⭐ **Lift verbatim (with tests)** |
| `apps/web/src/components/calendar/month-grid-model.ts` (+ 255-line test) | 168 + tests | Pure month-grid layout model: lane packing for multi-day bars, overflow counts, week-start handling. This is the fiddly part of any calendar. | ~1–2 days | ⭐ **Lift verbatim (with tests)** |
| `apps/web/src/lib/get-task-item-stats.ts` (+ test) | ~70 | Markdown task-list counter that correctly skips fenced code blocks and blockquote-prefixed fences. Genuinely subtle regex work, fully commented. | ~4h | ✅ **Lift** if we keep markdown checkboxes |
| `apps/web/src/index.css` — the `@media (prefers-reduced-motion)` block + `--ease-*` tokens | ~40 | Framework-agnostic CSS. Includes the dnd-kit `!important` neutralisation you would otherwise discover the hard way. | ~3h | ⭐ **Lift the block** |
| `apps/web/src/constants/shortcuts.ts` | ~48 | A *vocabulary*, not code. Reusing a well-designed chord scheme is free. | design time | ✅ **Lift as a spec** |
| `apps/web/src/constants/{label-colors,priority-colors,column-icons,project-icons}.ts` | small | Token-mapped palettes already proven in both themes | ~2h | ✅ Lift |
| `packages/permissions/src/index.ts` | 84 | The `{resource: [actions]}` statement vocabulary + role composition + "default roles are seeded rows, editable in UI" comment. Better-Auth's `createAccessControl` must be replaced, but **the vocabulary and the seeding policy are the valuable part.** | ~half a day of design | ✅ **Lift the vocabulary**, rewrite the mechanism |
| `apps/web/src/query-client/index.ts` — `isNetworkError` / `isCancellationError` + Sentry cooldown | ~60 | Pure error classification; directly useful for our offline story | ~2h | ✅ Lift the classifiers |
| `apps/web/src/lib/{get-initials,format,format-duration,to-kebab-case,copy-to-clipboard,debounce,generate-project-id}.ts` | tiny, tested | Trivia we'd otherwise rewrite | ~2h total | ✅ Lift opportunistically |
| `apps/web/src/lib/prepare-avatar-image.ts` | 117 | Client-side image resize/re-encode before upload — **directly reusable for site-photo downscaling** | ~4h | ✅ Lift |
| `apps/api/src/notification-preferences/delivery.ts` | 578 | Multi-channel fan-out (email / ntfy / gotify / HMAC-signed webhook) with timeouts, an SSRF guard (`assertPublicWebhookDestination`), and message templating per event type. Hono-free at its core; `db` calls are Drizzle → Prisma. | ~2–3 days of *design*, ~1 day of translation | ⚠️ **Port the design, not the file.** Highest-value backend idea in the repo. |
| `apps/api/src/scheduler/{leader-lock,reminder-timing,due-date-reminders}.ts` | ~240 | `job_lease` leader election + a `*_reminder_sent` idempotency ledger so a reminder fires exactly once across instances | ~1 day of design | ⚠️ **Take the pattern only** — we have BullMQ, which solves the locking half for us. Keep the **idempotency ledger** idea. |
| `apps/web/src/components/kanban-board/index.tsx` — the dnd-kit `useSensors` block + `dropAnimation` | ~25 | Same library, same React. The touch-sensor tuning transfers directly. | ~half a day of fiddling | ✅ **Lift the config block** |
| Everything else — controllers, routes, all React components, schema, auth, integrations, MCP, Helm | ~90% of repo | Hono / Drizzle / Better-Auth / TanStack Router / Base UI — all replaced by our locked stack | — | ❌ **Do not lift** |

**Honest verdict on §4:** *"Take the patterns, write the code — but do lift the five pure-logic files
and the reduced-motion CSS."* Total genuinely-liftable payload is roughly **600–900 lines** plus tests.
That is real (it removes 3–5 days of subtle calendar/date/regex work) but it is not a head start on the
application. The UI/UX patterns in §3 are worth far more than the code.

---

## 5. Attribution obligations

**Facts.** Kaneo is **MIT** (`LICENSE`, "Copyright (c) 2024 Andrej Acevski"). MIT requires exactly one
thing: *"The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software."* MIT is **GPL/AGPL-compatible** — MIT code may be incorporated
into an AGPL-3.0 work, and the combined work is distributed under AGPL-3.0 **provided the MIT notice
survives** for the incorporated portions. (Kaneo's copyright is not reassigned; our AGPL applies to the
combined work, not retroactively to their code.)

### What we must do — if and only if we lift code

| # | Obligation | How we record it |
|---|---|---|
| 1 | Preserve the MIT copyright + permission notice for the lifted portions | Create **`NOTICE`** (or `THIRD_PARTY_NOTICES.md`) at repo root containing the **full, verbatim** Kaneo MIT licence text under a heading naming the project, its URL, and the commit we took from (`42bb801…`, v2.22.0) |
| 2 | Make the notice discoverable from the licence | In `LICENSE` (AGPL-3.0), add a short pointer line: *"Portions of this software are derived from third-party MIT-licensed works; see NOTICE."* Do **not** edit the AGPL text body itself — append after it, or reference from `README.md` |
| 3 | Mark each lifted file at the top | A header comment on every file: <br>`// Derived from Kaneo (https://github.com/usekaneo/kaneo), MIT © 2024 Andrej Acevski.`<br>`// Source: apps/web/src/lib/task-schedule.ts @ 42bb801. Adapted: Drizzle types → Prisma types.` |
| 4 | Log the provenance in-repo | A row per lifted file in `NOTICE` (or `docs/THIRD_PARTY.md`): *our path · their path · commit · what changed*. This is what makes an audit trivial later. |
| 5 | README credit | One line under Credits: *"UI/UX and several utility modules are informed by [Kaneo](https://github.com/usekaneo/kaneo) (MIT)."* |
| 6 | Commit hygiene | The commit that introduces lifted code says so in its body, and adds/updates `NOTICE` **in the same commit** |

### What we do **not** owe

- **Ideas, schema shapes, layouts and interaction patterns are not copyrightable** — mirroring
  `column.isFinal`, the prefix-chord scheme, or the sheet-with-expand pattern creates **no obligation**.
  Attribution for those is courtesy, not law. (We will credit anyway — §5 row 5 covers it.)
- No obligation to contribute back, to notify the author, or to keep our fork in sync.
- No copyleft pull from MIT: it does not infect our AGPL choice in either direction.

### Recommendation

Keep the boundary **sharp and auditable**: put every lifted file under a single directory —
`src/lib/vendor/kaneo/` (or `packages/*/src/vendor/kaneo/`) — with its own `LICENSE` copy. One folder,
one notice, zero ambiguity at audit time. Anything outside that folder is ours.

> ⚠️ **Not legal advice.** Standard practice, and the FSF's own compatibility position, but if the repo
> is going public under D-2 the owner may want the `NOTICE` layout eyeballed once by counsel.

---

## RECOMMENDATION

### Prioritised carry list

| # | Carry | Type | Priority | Cost |
|---|---|---|---|---|
| 1 | Task detail as a **URL-param right sheet with expand-to-full-page**, one content component in both | UX | **P0** | low |
| 2 | **`column.isFinal`** + user-defined columns (never a hardcoded "done") | Schema | **P0** | trivial |
| 3 | **`project.lastTaskNumber` → `SLUG-42`** human task keys | Schema | **P0** | low |
| 4 | **Per-user display-field toggles + density preference** (their best UI idea) — with mobile forcing comfortable | UX | **P0** | low |
| 5 | **dnd-kit sensor config** (mouse 8px / touch 250ms+10px / keyboard) — lift verbatim | Code | **P0** | trivial |
| 6 | **Prefix-chord keyboard scheme + `?` help sheet + ⌘K palette** | UX | **P0** | low |
| 7 | Pure-logic lift: `due-date-status`, `task-schedule`, `month-grid-model`, `get-task-item-stats`, `prepare-avatar-image` **+ their tests** | Code | **P0** | ~1 day incl. NOTICE |
| 8 | **Three-level notification cascade** (user → workspace → project) + multi-channel fan-out design + `*_reminder_sent` idempotency ledger — geofence becomes a fourth channel | Design | **P0** | ~2 days design |
| 9 | Reduced-motion CSS block + `--ease-*` tokens | Code | **P1** | trivial |
| 10 | **`Empty` primitive**, skeletons-over-spinners, breadcrumb-**selects** | UX | **P1** | low |
| 11 | Unified **`activity` feed** with `eventData jsonb` + external-actor columns | Schema | **P1** | low |
| 12 | Data-driven **`workspace_role.permission jsonb`** custom roles + their permission vocabulary | Schema | **P1** | medium |
| 13 | Realtime **cache-patching** (not refetch) over our tRPC/SSE + Valkey | Pattern | **P1** | medium |
| 14 | **Public read-only project share** (`isPublic` + a public route) — strong client-facing sell | Feature | **P1** | low |
| 15 | Namespaced i18n structure from day one (EN + Tagalog) | Structure | **P1** | low |
| 16 | View-transition theme toggle | UX | **P2** | trivial |
| — | **REJECT:** `task.status` alongside `columnId`; per-task `label` rows; integer client-computed `position`; avatar bytes in Postgres; single assignee; dark default + `text-[11px]`; hamburger view switcher on phone; all billing/seats/COSS; the entire Hono/Drizzle/Better-Auth backend | — | — | — |
| — | **NET-NEW, no help from Kaneo:** geofencing (+ device registration + event audit), Client entity, document **revisions**, evidence-grade photo capture with an **offline outbox**, real Gantt (dependencies/baseline/work-calendar), inventory chain-of-custody, invoicing/PO/expenses, Syncthing integration, outdoor high-contrast theme | — | — | the bulk of the build |

### Unverified / follow-ups
- Expo background-geofence **region limits** (iOS ~20) — confirm via `context7` before the geofence schema is frozen (brief constraint 1). Not answerable from Kaneo.
- Kaneo has **no offline support**; our offline design has no prior art here — treat as net-new research.
- I read source, not a running instance; screenshot-level polish claims in §3 are inferred from component code and Tailwind classes, not from pixels. A quick `docker compose -f compose.yml up` on a local box would confirm feel before the DESIGN.md pass.

### Verdict

> **Kaneo shortens maybe 10% of the build — a few hundred lines of genuinely liftable pure logic and about two weeks of UI/UX and schema decision-making — and shortens 0% of what makes this product ours (geofencing, clients, revisions, evidence photos, inventory); take the patterns and roughly 600–900 lines, write everything else.**
