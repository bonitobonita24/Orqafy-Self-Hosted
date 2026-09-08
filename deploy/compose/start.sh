#!/usr/bin/env bash
# Orqafy Self-Hosted — dev Compose orchestrator (Phase 4 Part 7).
#
# Wires every -f compose file (db → infra → app) in dependency order and loads
# the Rule-22 .env.dev, so you never retype the flags. Dev only, HARD HOLD —
# ships as a Compose bundle (D-3); there is NO staging/prod here.
#
# Usage:
#   bash deploy/compose/start.sh dev up -d            # full stack
#   bash deploy/compose/start.sh dev up -d --build    # rebuild app AND worker
#   bash deploy/compose/start.sh dev down             # stop (keep volumes)
#   bash deploy/compose/start.sh dev down -v          # stop + drop data (careful)
#   bash deploy/compose/start.sh dev ps | logs -f app
#
# Bring up ONLY the infra tier (postgres+pgbouncer+valkey+minio+mailhog+pgadmin),
# e.g. to run the web app on the host via `pnpm --filter @orqafy/web dev`:
#   bash deploy/compose/start.sh dev --infra-only up -d
set -euo pipefail

ENV_NAME="${1:-dev}"
shift || true

if [[ "$ENV_NAME" != "dev" ]]; then
  echo "start.sh: only the 'dev' environment exists (HARD HOLD, D-3). Got: $ENV_NAME" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/dev"
ENV_FILE="$REPO_ROOT/.env.dev"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "start.sh: missing $ENV_FILE (gitignored dev env). Generate it at Phase 0 P0.5." >&2
  exit 3
fi

INFRA_ONLY=0
if [[ "${1:-}" == "--infra-only" ]]; then
  INFRA_ONLY=1
  shift
fi

FILES=(-f "$COMPOSE_DIR/docker-compose.db.yml" -f "$COMPOSE_DIR/docker-compose.infra.yml")
if [[ "$INFRA_ONLY" -eq 0 ]]; then
  FILES+=(-f "$COMPOSE_DIR/docker-compose.app.yml")
fi

set -x
exec docker compose --env-file "$ENV_FILE" "${FILES[@]}" "$@"
