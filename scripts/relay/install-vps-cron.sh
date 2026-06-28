#!/usr/bin/env bash
# Install VPS cron for drydock relay ↔ office sync.
set -euo pipefail

CRON_LINE='*/2 * * * * /root/relay-sync-office-bidirectional.sh >> /var/log/drydock-relay-sync.log 2>&1'

if crontab -l 2>/dev/null | grep -q relay-sync-office-bidirectional; then
  echo "Cron already installed."
  exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
echo "Installed: $CRON_LINE"
