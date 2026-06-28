#!/usr/bin/env bash
# Relay → office: push fleet-originated dry dock tender edits (ship / superintendent).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ENV_FILE="${RELAY_ENV_FILE:-/root/relay-installation.local.env}"
MANIFEST="${MANIFEST:-$ROOT/docs/sync/bucardo-relay-manifest.txt}"
RELAY_DB="${RELAY_DB:-drydock_sync_relay}"
VESSEL_ID="${VESSEL_ID:-}"
SYNC_OVERLAP_MINUTES="${SYNC_OVERLAP_MINUTES:-15}"
LOG_TAG="drydock-relay-push"
TMP="/tmp/drydock-relay-push-$$"
STATE_SCHEMA="relay_sync"
STATE_TABLE="relay_to_office_watermarks"

mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=relay-load-env.sh
source "$DIR/relay-load-env.sh"
# shellcheck source=relay-drydock-scope.sh
source "$DIR/relay-drydock-scope.sh"
RELAY_ENV_FILE="$ENV_FILE"
relay_load_env "$ROOT" || exit 1

if [[ -z "${OFFICE_DIRECT_DATABASE_URL:-}" ]]; then
  echo "[$LOG_TAG] OFFICE_DIRECT_DATABASE_URL not set" >&2
  exit 1
fi
if [[ -z "$VESSEL_ID" ]]; then
  echo "[$LOG_TAG] VESSEL_ID not set" >&2
  exit 1
fi

sudo -u postgres psql -d "$RELAY_DB" -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA IF NOT EXISTS ${STATE_SCHEMA};
CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.${STATE_TABLE} (
  table_name text PRIMARY KEY,
  last_synced_at timestamptz NOT NULL DEFAULT '1970-01-01'::timestamptz
);
SQL

echo "[$LOG_TAG] started $(date -Iseconds) vessel=$VESSEL_ID"

pushed=0
errors=0

while IFS= read -r table || [[ -n "${table:-}" ]]; do
  table="${table%%#*}"
  table="$(echo "$table" | xargs)"
  [[ -z "$table" ]] && continue

  pk_col="$(drydock_pk_column "$table")"
  scope_sql="$(drydock_push_scope_sql "$table" "$VESSEL_ID")"
  [[ "$scope_sql" == "false" ]] && continue

  time_col="relay_changed_at"
  has_col=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='${table}' AND column_name='${time_col}'
    )")
  [[ "$has_col" != "t" ]] && time_col="office_changed_at"

  watermark=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT COALESCE(
       (SELECT last_synced_at FROM ${STATE_SCHEMA}.${STATE_TABLE} WHERE table_name='${table}'),
       '1970-01-01'::timestamptz)")

  where_clause="(${scope_sql}) AND deleted_at IS NULL
    AND ${time_col} > ('${watermark}'::timestamptz - interval '${SYNC_OVERLAP_MINUTES} minutes')"

  count=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT count(*) FROM public.\"${table}\" WHERE ${where_clause}")
  [[ "${count:-0}" == "0" ]] && continue

  cols=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='${table}' AND column_name <> 'relay_changed_at'")

  csv="$TMP/${table}.csv"
  sql="$TMP/${table}.sql"
  max_ts=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT COALESCE(max(${time_col})::text, '${watermark}')
     FROM public.\"${table}\" WHERE ${where_clause}")

  sudo -u postgres psql -d "$RELAY_DB" -v ON_ERROR_STOP=1 -c \
    "\\copy (SELECT ${cols} FROM public.\"${table}\" WHERE ${where_clause})
          TO '${csv}' WITH (FORMAT csv, HEADER true)"
  chmod a+r "$csv"

  update_set=$(sudo -u postgres psql -d "$RELAY_DB" -tAc \
    "SELECT string_agg(format('%I = EXCLUDED.%I', column_name, column_name), ', ')
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='${table}'
       AND column_name NOT IN ('${pk_col}', 'relay_changed_at')")

  cat >"$sql" <<EOSQL
SET session_replication_role = replica;
CREATE TEMP TABLE staging (LIKE public."${table}" INCLUDING DEFAULTS);
\\copy staging (${cols}) FROM '${csv}' WITH (FORMAT csv, HEADER true)
INSERT INTO public."${table}" (${cols}) SELECT ${cols} FROM staging
ON CONFLICT ("${pk_col}") DO UPDATE SET ${update_set};
EOSQL

  if ! psql "$OFFICE_DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql"; then
    echo "[$LOG_TAG] upsert failed: $table" >&2
    ((errors++)) || true
    continue
  fi

  sudo -u postgres psql -d "$RELAY_DB" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO ${STATE_SCHEMA}.${STATE_TABLE} (table_name, last_synced_at)
     VALUES ('${table}', '${max_ts}'::timestamptz)
     ON CONFLICT (table_name) DO UPDATE
     SET last_synced_at = GREATEST(${STATE_SCHEMA}.${STATE_TABLE}.last_synced_at, EXCLUDED.last_synced_at)"

  echo "[$LOG_TAG] pushed $table rows=$count watermark=$max_ts"
  ((pushed++)) || true
done < "$MANIFEST"

echo "[$LOG_TAG] done pushed_tables=$pushed errors=$errors"
