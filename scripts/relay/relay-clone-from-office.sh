#!/usr/bin/env bash
# Full clone: office PostgreSQL → VPS drydock_sync_relay.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ENV_FILE="${RELAY_ENV_FILE:-$HOME/relay-installation.local.env}"
RELAY_DB="${RELAY_DB:-drydock_sync_relay}"
DUMP="/tmp/drydock_office_full.dump"
LOG="/tmp/drydock-relay-clone-$(date +%Y%m%d-%H%M%S).log"

exec > >(tee -a "$LOG") 2>&1

# shellcheck source=relay-load-env.sh
source "$DIR/relay-load-env.sh"
RELAY_ENV_FILE="$ENV_FILE"
relay_load_env "$ROOT" || exit 1

if [[ -z "${OFFICE_DIRECT_DATABASE_URL:-}" ]]; then
  echo "OFFICE_DIRECT_DATABASE_URL not set" >&2
  exit 1
fi

echo "=== Office → drydock relay clone started $(date -Iseconds) ==="
echo "Relay DB: $RELAY_DB"

command -v pg_dump >/dev/null || { apt update && apt install -y postgresql-client; }

pg_dump "$OFFICE_DIRECT_DATABASE_URL" --format=custom --no-owner --no-acl -f "$DUMP"

sudo -u postgres psql -v ON_ERROR_STOP=1 postgres <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${RELAY_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${RELAY_DB};
CREATE DATABASE ${RELAY_DB} ENCODING 'UTF8' TEMPLATE template0;
SQL

sudo -u postgres pg_restore --no-owner --no-acl -d "$RELAY_DB" "$DUMP"

bash "$DIR/relay-install-changed-at-triggers.sh"

echo "=== Clone complete. Log: $LOG ==="
