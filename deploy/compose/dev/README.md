# Orqafy Self-Hosted — dev Docker Compose bundle

Phase 4 Part 7. **Dev only, HARD HOLD.** Orqafy ships to installing firms as a
Docker Compose bundle (D-3) — there is **no** registry image, **no**
`docker-publish.yml`, and **no** Powerbyte staging/prod (D-2/D-3/D-27,
`docker.publish:false`). All ports are Rule-22 non-standard (base **56473**) and
come from the gitignored `.env.dev` — never hardcode them.

## Files

| File | Tier | Services |
|------|------|----------|
| `docker-compose.db.yml` | database | `postgres` (+ named volume, healthcheck), `pgbouncer` |
| `docker-compose.infra.yml` | infra | `valkey`, `minio` (+ console + `minio-init` bucket), `mailhog`, `pgadmin` |
| `docker-compose.app.yml` | application | `app` (@orqafy/web, Next.js dev), `worker` (@orqafy/jobs, BullMQ) |
| `Dockerfile.app` / `Dockerfile.worker` | build | dev images built from source (`dev_build:true`) |
| `pgadmin/servers.json` | config | pre-wired pgAdmin connections (host `orqafy_dev_postgres`) |

Named volumes: `orqafy_dev_pgdata`, `orqafy_dev_valkey`, `orqafy_dev_minio`,
`orqafy_dev_pgadmin`. Shared network: `orqafy_dev_net`.

## Run

```bash
# Full stack (from repo root):
bash deploy/compose/start.sh dev up -d --build   # rebuild app AND worker together
bash deploy/compose/start.sh dev ps
bash deploy/compose/start.sh dev logs -f app

# Infra only (run the web app on the host via pnpm for hot reload):
bash deploy/compose/start.sh dev --infra-only up -d
pnpm --filter @orqafy/db exec prisma migrate deploy   # apply migrations (DIRECT_URL)
pnpm --filter @orqafy/web dev

# Health probe:
bash tools/dev-smoke.sh

# Stop (keep data) / wipe:
bash deploy/compose/start.sh dev down
bash deploy/compose/start.sh dev down -v            # drops volumes — careful
```

## Ports (from `.env.dev`)

postgres `56473` · pgbouncer `56474` · valkey `56475` · minio `56476` ·
minio-console `56477` · pgadmin `56478` · mailhog-smtp `56479` ·
mailhog-ui `56480` · app `56483`.

## Notes

- **Migrations** use `DIRECT_URL` (direct Postgres); **app runtime** uses
  `DATABASE_URL` through PgBouncer in transaction mode (`?pgbouncer=true` so
  Prisma disables prepared statements).
- **Rebuild the app AND the worker together** — an app-only `--build` leaves the
  worker on stale code (deploy-discipline). `--build` on the full stack does both.
- Feature-phase sidecars (Nextcloud, OCR, optional Ollama) are **not** in this
  base bundle — they are added when their feature Part is built (scaffold plan §6).
