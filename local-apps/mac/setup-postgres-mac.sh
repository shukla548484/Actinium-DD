#!/bin/bash
# Setup local PostgreSQL for Actinium-DD (Mac).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"

echo "=== Actinium-DD — Mac PostgreSQL setup ==="

if ! command -v docker >/dev/null; then
  echo "Install Docker Desktop first: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

cd "$REPO_ROOT"
docker compose -f docker-compose.fleet.yml up -d

if [[ ! -f "$DIR/fleet.local.env" ]]; then
  cp "$DIR/fleet.local.env.example" "$DIR/fleet.local.env"
  echo "Created fleet.local.env — edit VESSEL_ID before first use."
fi

export $(grep -v '^#' "$DIR/fleet.local.env" | xargs)
cd "$REPO_ROOT"
npx prisma migrate deploy

echo "=== Setup complete ==="
echo "Edit $DIR/fleet.local.env then double-click start-actinium-dd.command"
