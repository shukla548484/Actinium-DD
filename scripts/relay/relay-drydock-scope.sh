#!/usr/bin/env bash
# Dry dock tender: per-table WHERE clauses for relay sync (project-scoped, not vessel_id on every row).
# shellcheck shell=bash

drydock_pk_column() {
  local table="$1"
  if [[ "$table" == "quote_meta" ]]; then
    echo "invite_id"
  else
    echo "id"
  fi
}

drydock_pull_scope_sql() {
  local table="$1"
  local vessel_id="$2"
  case "$table" in
    projects)
      printf "vessel_id = '%s'" "$vessel_id"
      ;;
    spec_lines|yard_invites|compare_snapshots)
      printf "project_id IN (SELECT id FROM projects WHERE vessel_id = '%s' AND deleted_at IS NULL)" "$vessel_id"
      ;;
    quote_meta)
      printf "invite_id IN (
        SELECT yi.id FROM yard_invites yi
        INNER JOIN projects p ON p.id = yi.project_id
        WHERE p.vessel_id = '%s' AND yi.deleted_at IS NULL AND p.deleted_at IS NULL
      )" "$vessel_id"
      ;;
    quote_lines)
      printf "invite_id IN (
        SELECT yi.id FROM yard_invites yi
        INNER JOIN projects p ON p.id = yi.project_id
        WHERE p.vessel_id = '%s' AND yi.deleted_at IS NULL AND p.deleted_at IS NULL
      )" "$vessel_id"
      ;;
    sync_tombstones)
      printf "(vessel_id = '%s' OR vessel_id IS NULL)" "$vessel_id"
      ;;
    *)
      echo "false"
      ;;
  esac
}

drydock_push_scope_sql() {
  local table="$1"
  local vessel_id="$2"
  local scope
  scope="$(drydock_pull_scope_sql "$table" "$vessel_id")"
  printf "%s AND origin_node IN ('ship', 'superintendent')" "$scope"
}
