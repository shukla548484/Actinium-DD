#!/usr/bin/env bash
# Phase A — Deploy relay scripts to VPS and run bootstrap (when SSH works).
set -euo pipefail

VPS="${VPS:?Set VPS=your.vps.ip (e.g. 174.138.189.162)}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

echo "=== Phase A deploy → $VPS ==="

echo "[1/3] Copy relay scripts…"
bash "$DIR/deploy-to-vps.sh"

echo "[2/3] Copy env template…"
scp "$ROOT/docs/sync/relay-installation.local.env.example" "root@${VPS}:/root/relay-installation.local.env.example"

echo "[3/3] Remote bootstrap (requires /root/relay-installation.local.env configured)…"
if ssh -o ConnectTimeout=10 "root@${VPS}" 'test -f /root/relay-installation.local.env'; then
  ssh "root@${VPS}" 'bash /root/vps-bootstrap.sh' || {
    echo "Remote bootstrap failed. SSH in and run: bash /root/vps-bootstrap.sh" >&2
    exit 1
  }
else
  echo ""
  echo "Next steps ON VPS:"
  echo "  ssh root@${VPS}"
  echo "  cp /root/relay-installation.local.env.example /root/relay-installation.local.env"
  echo "  nano /root/relay-installation.local.env   # set OFFICE_DIRECT_DATABASE_URL, VESSEL_ID"
  echo "  bash /root/vps-bootstrap.sh"
  echo ""
  echo "On office machine:"
  echo "  bash scripts/relay/office-bootstrap.sh"
fi

echo "=== Phase A deploy finished ==="
