#!/bin/bash
# Double-click launcher — starts PostgreSQL sidecar + Actinium-DD app.
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
export FLEET_ENV_FILE="$DIR/fleet.local.env"

if [[ -f "$DIR/fleet.local.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$DIR/fleet.local.env"
  set +a
fi

cd "$REPO_ROOT"

# Start sidecar in background
nohup node scripts/fleet-sidecar.mjs >> "$DIR/sidecar.log" 2>&1 &
sleep 3

# Open built app or fall back to dev
APP="$DIR/Actinium-DD.app"
if [[ -d "$APP" ]]; then
  open -a "$APP"
else
  APP2=$(find "$DIR" -maxdepth 1 -name "*.app" | head -1)
  if [[ -n "$APP2" ]]; then
    open -a "$APP2"
  else
    osascript -e 'display alert "Actinium-DD app not found. Run npm run desktop:build first."'
    npm run fleet:dev
  fi
fi
