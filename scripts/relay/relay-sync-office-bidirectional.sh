#!/usr/bin/env bash
# Bidirectional dry dock relay ↔ office sync (no Bucardo on office).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_TAG="drydock-relay-office-bidir"

echo "[$LOG_TAG] === cycle start $(date -Iseconds) ==="
bash "$DIR/relay-pull-from-office.sh"
bash "$DIR/relay-push-to-office.sh"
echo "[$LOG_TAG] === cycle end $(date -Iseconds) ==="
