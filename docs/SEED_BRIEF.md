# Orqafy-Self-Hosted — Seed Brief

> **Status:** PRE-SPEC. Nothing scaffolded, no code. This file is the cold-start authority for the
> Planning Assistant session that will produce `docs/PRODUCT.md`.
> **Authored:** 2026-09-06, from the owner's founding brief (AIEF seat) + 4 confirmed decisions.
> **Owner:** Bonito · Powerbyte IT Solutions, Calapan City, Oriental Mindoro PH

---

## 1. What this app is

The **free, open-source, self-hosted** sibling of the commercial **Orqafy**, re-aimed at a specific
audience: **construction engineers and architects**. Feature set is deliberately narrower and the
approach differs — this is not a repackaged Orqafy, it is a derived product.

Reference (read-only, never edited from this repo): `../CompanyApps/Orqafy`.

**Design/UX starting point:** [Kaneo](https://github.com/usekaneo/kaneo) — MIT, TypeScript,
Hono + React, self-hosted PM/kanban, actively maintained (755 forks, pushed 2026-09-05). The owner
likes its UI/UX. Used as a **visual + interaction reference and a schema idea source**, not as the
codebase (see D-1).

---

## 2. Confirmed decisions (owner, 2026-09-06)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| **D-1** | Kaneo usage | **AIEF locked stack; Kaneo as UI/UX + domain reference only** | Next.js · tRPC · Prisma · Auth.js v5 · PostgreSQL · Valkey · BullMQ · MinIO→S3 · shadcn/ui. All 41 framework rules, L1-L6 security and tenant-RBAC apply. Kaneo's Hono/Drizzle backend is NOT adopted. |
| **D-2** | License & visibility | **AGPL-3.0, public repo** | Genuinely open-source; anyone hosting a modified version as a service must publish changes — protects commercial Orqafy from being resold as SaaS. Forces a hard public/private file boundary (§4). |
| **D-3** | Server install form | **Docker Compose first; native installer later** | v1 ships a one-command Compose bundle. A Tauri/Electron double-click installer is a later track, explicitly on the roadmap, not v1. |
| **D-4** | v1 scope | **Phase it — PM + files + geofence first** | v1 = projects/kanban/todos/scheduling/Gantt + file management + geofenced notifications + mobile app. v2 = invoicing, POs, inventory ledger, company expenses. |

---

## 3. The 7 modules (full target product)

**v1 (build first)**

- **(a) Project Management** — multiple projects per client. Kanban, todo lists, task assignment,
  scheduling, Gantt. Location-aware tasks (see g). Per-project shortcuts into files, and later into
  invoices/expenses/POs/inventory draw-down.
- **(f) File/folder management** — Drive-like **two-way sync** of each user's PC folders, with
  revision history. Files/folders attachable as shortcuts to a project, invoice, expense or todo.
  → **Adopt, don't build**: wrap/embed Syncthing (or equivalent) rather than writing a sync engine.
- **(g) Notifications** — the standard set (assignment, due date, mention, status change) **plus the
  product differentiator: geofenced task alerts.** A task carries a location + radius; crossing into
  that radius fires *"you have something to do here — check it out."*
  Owner's rationale: time-based alerts get dismissed once seen, and you cannot predict when you will
  be on a given site; **presence is the more reliable trigger** for site work.
- **Mobile** — Android/iOS + PWA: tasks, calendar of activities, assignments, **photo capture against
  tasks and project milestones**, Gantt viewing.

**v2 (spec now at a high level, build after v1)**

- **(b) Invoicing** — standalone sales/services invoices, independent of any project.
- **(c) Purchase orders → inventory** — POs exist to bring stock *into* inventory.
- **(d) Company expenses** — regular operating spend.
- **(e) Inventory management** — full chain of custody: **purchased → stocked → released** to a
  project (as project expense) or sold on an invoice. Every unit must be traceable to where it went.

---

## 4. Hard constraints (established facts — do not re-litigate without evidence)

1. **Geofencing is native-only.** Background geofence wake-ups require a native app
   (Expo + `expo-location` / `expo-task-manager`). **iOS gives PWAs no background location at all**;
   Android PWA behaviour is unreliable. Therefore the mobile app **must** be Expo native for the
   geofence carrier; the PWA is a complementary desk/tablet surface, never the geofence path.
   → Verify current Expo background-location capabilities via `context7` before Phase 3.
2. **Public repo ⇒ private assets must never be committed.** Because of D-2, this repo must NOT
   contain:
   - the AIEF framework files (`.ai_prompt/`, `AI/`, `CLAUDE.md`'s framework body, `scripts/` gates
     that ship framework IP), and
   - the **AdminCN starter slice** (`starter/admincn/`) — a paid template, **no redistribution**.
   The app is *built with* the framework and *shipped without* it. `.gitignore` must enforce this
   from the first commit, and a pre-push check should assert it.
3. **Kaneo covers ~15–20% of this scope.** It provides projects/kanban/issues/auth/UI. Invoicing,
   POs, inventory ledger, expenses, file sync, geofencing, NAS storage, desktop packaging and mobile
   are all net-new.
4. **Full bidirectional file sync is its own product.** Writing one from scratch is a multi-month
   subsystem. Adopt an existing FOSS engine (Syncthing is the prior) — see constraint in (f).
5. **HARD HOLD.** Local only. No staging, no production, no deploy of any kind until the owner
   explicitly says so, per `~/.claude/rules/deploy-discipline.md`.

---

## 5. Open research — [HOW], agent-owned, resolve during planning

Each produces a short decision doc under `docs/planning/` with a recommendation.

- **R-1 · Remote access overlay.** The server must be reachable anytime/anywhere and log in at the
  server's own domain. Survey current FOSS Tailscale alternatives on GitHub — priors:
  **Headscale** (self-hosted Tailscale control plane), **NetBird**, **Netmaker**, **Nebula**,
  **Pangolin** (self-hosted tunneled reverse proxy + Newt agent; strong fit for domain-based access).
  Evaluate on: self-hostable control plane, licence, NAT traversal, mobile clients, ease for a
  non-technical site office, and how cleanly it pairs with Traefik + a real domain.
- **R-2 · NAS storage.** UGREEN NASync **DH2300** — determine which access technologies it actually
  exposes (SMB/CIFS, NFS, WebDAV, and whether UGOS Pro on this model supports Docker/containers).
  Decide how the server writes assets to it: host-mounted share behind our storage abstraction, or
  MinIO running on the NAS. Must degrade gracefully when the NAS is absent (local disk fallback).
- **R-3 · File-sync engine.** Syncthing vs alternatives, and how a per-user desktop agent maps to
  project-scoped shortcuts and revisioning in the app.
- **R-4 · Kaneo teardown.** Read its schema and UI structure for domain ideas and interaction
  patterns worth carrying over (MIT — attribution required if any code is lifted).

---

## 6. Out of scope (unless the owner reopens)

Payroll/HR; a full accounting ledger beyond the five finance modules; BIM/CAD file *viewing*;
feature parity with commercial Orqafy; any deploy target beyond local dev; editing the real
Orqafy repo (read-only reference only).

---

## 7. Next step — the Planning Assistant interview

This project is spec-first. **Do not scaffold anything** until `docs/PRODUCT.md` exists and the
owner has approved it.

1. Run the **Planning Assistant** (`Powerbyte-AIEF/specdrivenprompt/Planning_Assistant.md`) in a
   session opened **in this folder** — the 9-step interview, seeded by this brief so the owner is
   not re-asked what is already decided above.
2. Produce **`docs/PRODUCT.md`** (12 required sections).
3. Step 7 → **`docs/DESIGN.md`** (design tokens; Kaneo as visual reference, shadcn/ui + fleet default
   typeface IBM Plex Sans / JetBrains Mono).
4. Phase 2.8 → **`docs/MOCKUP.jsx`** for visual verification before any build.
5. Resolve R-1…R-4 in parallel; back-port each answer into PRODUCT.md before Phase 0.
