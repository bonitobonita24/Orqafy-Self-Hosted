#!/usr/bin/env bash
# tools/dev-smoke.sh — quick health probe of the dev Compose stack (Part 7).
# Reads the Rule-22 ports from .env.dev and pings each published service. Dev
# only; read-only (no mutations). Exit non-zero if any required service is down.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.dev"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "dev-smoke: missing $ENV_FILE" >&2
  exit 3
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

fail=0
probe() { # name host port
  if (echo > "/dev/tcp/$2/$3") 2>/dev/null; then
    printf '  ✅ %-10s localhost:%s\n' "$1" "$3"
  else
    printf '  ❌ %-10s localhost:%s (unreachable)\n' "$1" "$3"; fail=1
  fi
}

echo "Orqafy dev stack — port probe:"
probe postgres   127.0.0.1 "${POSTGRES_PORT}"
probe pgbouncer  127.0.0.1 "${PGBOUNCER_PORT}"
probe valkey     127.0.0.1 "${VALKEY_PORT}"
probe minio      127.0.0.1 "${MINIO_PORT}"
probe minio-ui   127.0.0.1 "${MINIO_CONSOLE_PORT}"
probe mailhog-ui 127.0.0.1 "${MAILHOG_UI_PORT}"
probe pgadmin    127.0.0.1 "${PGADMIN_PORT}"
probe app        127.0.0.1 "${APP_PORT}"

exit "$fail"
