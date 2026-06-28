#!/usr/bin/env bash
# Install office_changed_at triggers on office master DB (server time).
# Run once on office PostgreSQL after migrations:
#   bash scripts/relay/office-install-changed-at-triggers.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ENV_FILE="${RELAY_ENV_FILE:-$ROOT/docs/sync/relay-installation.local.env}"
MANIFEST="${MANIFEST:-$ROOT/docs/sync/bucardo-relay-manifest.txt}"
OFFICE_DB="${OFFICE_DB:-}"

# shellcheck source=relay-load-env.sh
source "$DIR/relay-load-env.sh"
RELAY_ENV_FILE="$ENV_FILE"
relay_load_env "$ROOT" || exit 1

if [[ -z "${OFFICE_DIRECT_DATABASE_URL:-}" ]]; then
  echo "OFFICE_DIRECT_DATABASE_URL not set" >&2
  exit 1
fi

tables=()
while IFS= read -r t || [[ -n "${t:-}" ]]; do
  t="${t%%#*}"
  t="$(echo "$t" | xargs)"
  [[ -z "$t" ]] && continue
  tables+=("$t")
done < "$MANIFEST"

sql="/tmp/office-changed-at-$$.sql"
{
  echo "CREATE SCHEMA IF NOT EXISTS relay_sync;"
  echo "CREATE OR REPLACE FUNCTION relay_sync.set_office_changed_at()"
  echo "RETURNS trigger LANGUAGE plpgsql AS \$\$"
  echo "BEGIN"
  echo "  NEW.office_changed_at = now();"
  echo "  RETURN NEW;"
  echo "END;"
  echo "\$\$;"
  echo "SET session_replication_role = replica;"
  for t in "${tables[@]}"; do
    echo "ALTER TABLE public.\"${t}\" ADD COLUMN IF NOT EXISTS office_changed_at timestamptz;"
    echo "UPDATE public.\"${t}\" SET office_changed_at = COALESCE(updated_at, created_at, now()) WHERE office_changed_at IS NULL;"
    echo "DROP TRIGGER IF EXISTS office_changed_at_set ON public.\"${t}\";"
    echo "CREATE TRIGGER office_changed_at_set"
    echo "  BEFORE INSERT OR UPDATE ON public.\"${t}\""
    echo "  FOR EACH ROW EXECUTE FUNCTION relay_sync.set_office_changed_at();"
  done
  echo "SET session_replication_role = origin;"
} >"$sql"

echo "Installing office_changed_at on ${#tables[@]} tables ..."
psql "$OFFICE_DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql"
rm -f "$sql"
echo "Done."
