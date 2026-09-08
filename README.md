# Orqafy-Self-Hosted

**Free, open-source, self-hosted project management for construction engineers and architects.**

> ⚠️ **Pre-spec.** No application code yet. This repository currently holds the founding brief and
> planning artifacts only. Start at [`docs/SEED_BRIEF.md`](docs/SEED_BRIEF.md).

Runs on an ordinary desktop as its own server — your data stays on your own storage (including a
NAS on the same machine), your team connects over the local network, and the site crew reaches it
from anywhere through a self-hosted overlay network.

## What makes it different

Most project tools notify you by **time** — a due date you dismiss the moment you see it. On a
construction job you rarely know *when* you'll be at a given site. So this one also notifies you by
**place**: attach a location and radius to a task, and when you arrive, your phone tells you
*"you have something to do here."*

## Planned scope

**v1** — projects & clients · kanban · todos · task assignment · scheduling · Gantt ·
file/folder management with revisions · geofenced notifications · mobile app (photo capture against
tasks and milestones)

**v2** — invoicing · purchase orders · inventory with full chain of custody · company expenses

## Status

| | |
|---|---|
| Stage | Planning — Planning Assistant interview not yet run |
| Licence | AGPL-3.0 (see `docs/SEED_BRIEF.md` D-2) |
| Install | Docker Compose first; native desktop installer later |
| Deploy | **Local only.** No staging or production target. |

## Contributing (local setup)

This repo is AGPL-3.0 and public: it must never carry the AIEF framework files it was built with,
or any paid template slice. A guard enforces that. **Run it once per clone:**

```bash
bash scripts/install-git-hooks.sh
```

This installs `pre-commit` and `pre-push` hooks that refuse any commit/push containing `.ai_prompt/`,
`AI/`, `starter/admincn/`, `.claude/`, or `CLAUDE.md`. Run the check manually any time with
`bash scripts/check-public-assets.sh --tracked`.

---

Built by [Powerbyte IT Solutions](https://powerbyteitsolutions.com) — Calapan City, Oriental Mindoro, Philippines.
UI/UX reference: [Kaneo](https://github.com/usekaneo/kaneo) (MIT).
