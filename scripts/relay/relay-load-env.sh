#!/usr/bin/env bash
# Shared env loader for dry dock relay ↔ office scripts.
# shellcheck shell=bash

relay_normalize_url() {
  local url="${1:-}"
  url="${url//$'\r'/}"
  url="${url//$'\n'/}"
  url="${url#"${url%%[![:space:]]*}"}"
  url="${url%"${url##*[![:space:]]}"}"
  printf '%s' "$url"
}

relay_load_env() {
  local root_hint="${1:-}"
  local env_file="${RELAY_ENV_FILE:-}"

  if [[ -z "$env_file" || ! -f "$env_file" ]]; then
    for candidate in \
      "$env_file" \
      "${root_hint:+$root_hint/docs/sync/relay-installation.local.env}" \
      "$HOME/relay-installation.local.env" \
      "/root/relay-installation.local.env"; do
      [[ -n "$candidate" && -f "$candidate" ]] && env_file="$candidate" && break
    done
  fi

  if [[ -z "$env_file" || ! -f "$env_file" ]]; then
    echo "relay_load_env: missing relay env (set RELAY_ENV_FILE or create relay-installation.local.env)" >&2
    return 1
  fi

  # shellcheck source=/dev/null
  source "$env_file"

  if [[ -n "${OFFICE_DIRECT_DATABASE_URL:-}" ]]; then
    OFFICE_DIRECT_DATABASE_URL="$(relay_normalize_url "$OFFICE_DIRECT_DATABASE_URL")"
    export OFFICE_DIRECT_DATABASE_URL
  fi
  if [[ -n "${VESSEL_ID:-}" ]]; then
    VESSEL_ID="$(relay_normalize_url "$VESSEL_ID")"
    export VESSEL_ID
  fi

  export PGSSLMODE="${PGSSLMODE:-require}"
}
