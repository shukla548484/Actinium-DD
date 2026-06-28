#!/usr/bin/env bash
# Phase A — VPS bootstrap: PostgreSQL relay DB + clone + cron.
# Run ON the VPS as root after copying relay-installation.local.env to /root/
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${RELAY_ENV_FILE:-/root/relay-installation.local.env}"

echo "=== Dry Dock — VPS relay bootstrap ==="

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy docs/sync/relay-installation.local.env.example → /root/relay-installation.local.env"
  echo "Set OFFICE_DIRECT_DATABASE_URL and VESSEL_ID, then re-run."
  exit 1
fi

export RELAY_ENV_FILE="$ENV_FILE"

echo "[1/5] Install PostgreSQL client tools (if needed)…"
if ! command -v pg_dump >/dev/null; then
  if command -v apt-get >/dev/null; then
    apt-get update && apt-get install -y postgresql postgresql-client
  elif command -v dnf >/dev/null; then
    dnf install -y postgresql-server postgresql
    postgresql-setup --initdb 2>/dev/null || true
    systemctl enable --now postgresql 2>/dev/null || systemctl enable --now postgresql-16 2>/dev/null || true
  fi
fi

echo "[2/5] Ensure PostgreSQL is running…"
systemctl start postgresql 2>/dev/null || systemctl start postgresql-16 2>/dev/null || true

echo "[3/5] Clone office → drydock_sync_relay…"
bash "$DIR/relay-clone-from-office.sh"

echo "[4/5] Apply Bucardo relay grants…"
if [[ -f /root/bucardo-relay-postgres-grants.sql ]]; then
  sudo -u postgres psql -d drydock_sync_relay -f /root/bucardo-relay-postgres-grants.sql || true
fi

echo "[5/5] Install relay cron (every 2 min)…"
bash "$DIR/install-vps-cron.sh"

echo "=== VPS bootstrap complete ==="
echo "Verify: tail -f /var/log/drydock-relay-sync.log"
