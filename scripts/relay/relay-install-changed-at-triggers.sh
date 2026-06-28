#!/usr/bin/env bash
# Install relay_changed_at triggers on VPS relay DB.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
MANIFEST="${MANIFEST:-$ROOT/docs/sync/bucardo-relay-manifest.txt}"
RELAY_DB="${RELAY_DB:-drydock_sync_relay}"

tables=()
while IFS= read -r t || [[ -n "${t:-}" ]]; do
  t="${t%%#*}"
  t="$(echo "$t" | xargs)"
  [[ -z "$t" ]] && continue
  tables+=("$t")
done < "$MANIFEST"

sql="/tmp/relay-changed-at-$$.sql"
{
  echo "CREATE SCHEMA IF NOT EXISTS relay_sync;"
  echo "CREATE OR REPLACE FUNCTION relay_sync.set_relay_changed_at()"
  echo "RETURNS trigger LANGUAGE plpgsql AS \$\$"
  echo "BEGIN"
  echo "  NEW.relay_changed_at = now();"
  echo "  RETURN NEW;"
  echo "END;"
  echo "\$\$;"
  echo "SET session_replication_role = replica;"
  for t in "${tables[@]}"; do
    echo "ALTER TABLE public.\"${t}\" ADD COLUMN IF NOT EXISTS relay_changed_at timestamptz;"
    echo "UPDATE public.\"${t}\" SET relay_changed_at = now() WHERE relay_changed_at IS NULL;"
    echo "DROP TRIGGER IF EXISTS relay_changed_at_set ON public.\"${t}\";"
    echo "CREATE TRIGGER relay_changed_at_set"
    echo "  BEFORE INSERT OR UPDATE ON public.\"${t}\""
    echo "  FOR EACH ROW EXECUTE FUNCTION relay_sync.set_relay_changed_at();"
  done
  echo "SET session_replication_role = origin;"
} >"$sql"

echo "Installing relay_changed_at on ${#tables[@]} tables in $RELAY_DB ..."
sudo -u postgres psql -d "$RELAY_DB" -v ON_ERROR_STOP=1 -f "$sql"
rm -f "$sql"
echo "Done."
