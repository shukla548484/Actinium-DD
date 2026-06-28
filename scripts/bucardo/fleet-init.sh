#!/usr/bin/env bash
# Initialize ship local PostgreSQL + Bucardo sync to VPS relay.
# Prerequisites: PostgreSQL running, relay seeded, Bucardo installed.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ENV_FILE="${FLEET_ENV_FILE:-$ROOT/docs/sync/fleet.local.env}"
NODE_NAME="${NODE_NAME:-ship}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

LOCAL_DB="${LOCAL_DATABASE_URL:-${DATABASE_URL:-}}"
RELAY_DB="${RELAY_DATABASE_URL:-}"

if [[ -z "$LOCAL_DB" || -z "$RELAY_DB" ]]; then
  echo "Set LOCAL_DATABASE_URL and RELAY_DATABASE_URL in $ENV_FILE" >&2
  exit 1
fi

echo "=== [$NODE_NAME] 1/4 Prisma migrate local DB ==="
cd "$ROOT"
npx prisma migrate deploy

echo "=== [$NODE_NAME] 2/4 Clone schema from relay (pg_dump) ==="
DUMP="/tmp/drydock-relay-clone-$$.dump"
pg_dump "$RELAY_DB" --format=custom --no-owner --no-acl -f "$DUMP"
pg_restore --clean --if-exists --no-owner --no-acl -d "$LOCAL_DB" "$DUMP" || true
rm -f "$DUMP"

echo "=== [$NODE_NAME] 3/4 Register Bucardo dbgroups (manual step) ==="
cat <<EOF

Add Bucardo sync groups (example — adjust host/credentials):

  bucardo add database local name=drydock_${NODE_NAME} conn='${LOCAL_DB}'
  bucardo add database relay name=drydock_relay conn='${RELAY_DB}'

  bucardo add sync drydock_${NODE_NAME}_to_relay   source=drydock_${NODE_NAME} target=drydock_relay relcopy
  bucardo add sync drydock_${NODE_NAME}_from_relay source=drydock_relay target=drydock_${NODE_NAME} relcopy

  bucardo add tables \$(cat $ROOT/docs/sync/bucardo-relay-manifest.txt | grep -v '^#' | paste -sd' ')
  bucardo add sync drydock_${NODE_NAME}_to_relay   tables=all
  bucardo add sync drydock_${NODE_NAME}_from_relay tables=all

  bucardo start

EOF

echo "=== [$NODE_NAME] 4/4 Start fleet API + desktop ==="
echo "  export \$(grep -v '^#' $ENV_FILE | xargs)"
echo "  npm run fleet:dev"
