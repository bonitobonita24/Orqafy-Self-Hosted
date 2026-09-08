# Orqafy Self-Hosted

**Free, open-source, self-hosted project management for construction engineers and architects** —
construction PM, file sync, and geofenced site tasks, running on your own hardware.

Runs on an ordinary desktop as its own server: your data stays on your own storage (including a NAS
on the same machine), your team connects over the local network, and the site crew reaches it from
anywhere through a self-hosted overlay network. No SaaS, no per-seat fees, no vendor lock-in.

## What makes it different

Most project tools notify you by **time** — a due date you dismiss the moment you see it. On a
construction job you rarely know *when* you'll be at a given site. So Orqafy also notifies you by
**place**: attach a location and radius to a task, and when you arrive on site, your phone tells you
*"you have something to do here."* (Geofencing needs the native mobile app — see status below.)

## Status — honest and current

**v1 web core is in active development.** The Next.js web application boots and the core
project-management surface works end to end:

| Area | State |
|------|-------|
| First-run setup (`/setup`), auth/login | ✅ Working |
| Clients · Projects · Tasks (create / edit, tRPC-backed) | ✅ Working |
| Dashboard · Leave · Notifications · Users/settings | ✅ Working (leave & notifications: core flows) |
| Kanban drag-drop · Gantt · Leaflet map picker | 🚧 In progress (UI stubs wired to data next) |
| Document upload · OCR / document-AI · file sync | 🚧 Later wave (adapters in place, feature parts pending) |
| Expo mobile app (photo capture + **geofenced notifications**) | 🗓️ Later wave — the geofencing differentiator lives here |
| Tauri desktop shell | 🗓️ Later wave |

Nothing above is claimed done that isn't. The repository is a monorepo of eight `@orqafy/*` packages
plus `apps/web`; typecheck, lint, tests, and the web build are green, and the dev stack has been
run end to end (first-run → login → dashboard → Client/Project/Task CRUD, persisted).

## Planned scope

**v1** — projects & clients · kanban · todos · task assignment · scheduling · Gantt · file/folder
management with revisions · geofenced notifications · mobile app (photo capture against tasks and
milestones)

**v2** — invoicing · purchase orders · inventory with full chain of custody · company expenses

## Tech stack

- **Web:** Next.js (App Router) · tRPC · Auth.js v5 · React 19 · TypeScript
- **UI:** shadcn/ui + Kibo UI (kanban / Gantt / dropzone) · Leaflet + OpenStreetMap
- **Data:** PostgreSQL (via PgBouncer) · Prisma ORM
- **Async / cache:** Valkey · BullMQ workers
- **Object storage:** MinIO (S3-compatible — also plain local disk or a NAS/NFS mount, same code path)
- **Mobile / desktop (later waves):** Expo / React Native · Tauri (Rust sidecar)

A single-company install: there is **no** multi-tenant model and no built-in billing.

## Self-host quickstart

**Prerequisites:** Docker + Docker Compose, and (for the migrate step / host-run mode) Node.js 22 with
[pnpm](https://pnpm.io). The dev stack uses non-standard ports defined in your `.env.dev`.

```bash
# 1. Clone
git clone <your-fork-or-clone-url> orqafy && cd orqafy

# 2. Configure — copy the template and fill in the placeholders (DB user, generated
#    passwords/keys, AUTH_SECRET). Every <...> in the file must be replaced.
cp .env.example .env.dev
$EDITOR .env.dev

# 3. Bring up the full dev stack (Postgres + PgBouncer, Valkey, MinIO, MailHog,
#    pgAdmin, the web app, and the worker). Rebuild the app AND worker together.
bash deploy/compose/start.sh dev up -d --build

# 4. Apply the database schema (run once, and after any schema change).
pnpm install
pnpm --filter @orqafy/db exec prisma migrate deploy

# 5. Open the app. The default APP_PORT is 56483 (whatever you set in .env.dev):
#    http://localhost:56483
```

On first visit the app sends you to **`/setup`**, where **you create your own admin account**. There
are no default or vendor credentials — the operator who installs Orqafy owns the first login.

Prefer hot reload while developing? Bring up only the infrastructure tier in Docker and run the web
app on your host:

```bash
bash deploy/compose/start.sh dev --infra-only up -d
pnpm --filter @orqafy/db exec prisma migrate deploy
pnpm --filter @orqafy/web dev
```

Full details, ports, and health probes are in [`deploy/compose/dev/README.md`](deploy/compose/dev/README.md).

## Licence

Orqafy Self-Hosted is licensed under the **GNU Affero General Public License v3.0** — see
[`LICENSE`](LICENSE). If you run a modified version as a network service, the AGPL requires you to
offer that service's users the corresponding source.

## Contributing

Contributions are welcome. Before your first commit, install the repository's git hooks:

```bash
bash scripts/install-git-hooks.sh
```

This installs `pre-commit` and `pre-push` guards that keep the public repository clean. Run the check
manually any time with `bash scripts/check-public-assets.sh --tracked`.

**About the build tooling.** Orqafy is built *with* an internal development framework, but shipped
*without* it: the framework's private files (`.ai_prompt/`, `AI/`, the paid `starter/admincn/` slice,
`.claude/`, `CLAUDE.md`, and the framework's own scripts) are intentionally **not** part of this
public, AGPL-licensed repository, and the guard above enforces that. You do not need any of them to
build, run, or contribute to Orqafy — the standard commands (`pnpm install`, `pnpm dev`, `pnpm build`)
are all you need.

---

Built by [Powerbyte IT Solutions](https://powerbyteitsolutions.com) — Calapan City, Oriental Mindoro,
Philippines. UI/UX reference: [Kaneo](https://github.com/usekaneo/kaneo) (MIT).
