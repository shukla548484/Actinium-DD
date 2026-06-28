#!/usr/bin/env bash
# Deploy dry dock relay scripts to VPS /root/
set -euo pipefail

VPS="${VPS:?Set VPS=your.vps.ip}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

scp "$DIR"/relay-*.sh "$DIR"/office-install-changed-at-triggers.sh \
  "$DIR"/vps-bootstrap.sh "$DIR"/install-vps-cron.sh \
  "root@${VPS}:/root/"

scp "$ROOT/docs/sync/bucardo-relay-manifest.txt" "root@${VPS}:/root/"
scp "$ROOT/docs/sync/bucardo-relay-postgres-grants.sql" "root@${VPS}:/root/"

ssh "root@${VPS}" 'chmod +x /root/relay-*.sh /root/office-install-changed-at-triggers.sh /root/vps-bootstrap.sh /root/install-vps-cron.sh'

echo "Deployed relay scripts to ${VPS}:/root/"
