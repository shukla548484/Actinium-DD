#!/usr/bin/env bash
# Phase A — Office bootstrap: migrations + changed_at triggers.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

echo "=== Dry Dock — Office bootstrap ==="

if [[ ! -f "$ROOT/.env" && -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in .env or environment" >&2
  exit 1
fi

cd "$ROOT"
echo "[1/2] Prisma migrate deploy…"
npx prisma migrate deploy

echo "[2/2] Install office changed_at triggers…"
bash "$DIR/office-install-changed-at-triggers.sh"

echo "=== Office bootstrap complete ==="
