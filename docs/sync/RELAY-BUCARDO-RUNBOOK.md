# Relay + Bucardo runbook — Actinium-DD

Production path: **local Postgres (ship / superintendent) ↔ VPS relay ↔ office master**.

| Leg | Mechanism |
|-----|-----------|
| Ship / superintendent ↔ relay | **Bucardo** on fleet PC |
| Relay ↔ office | **VPS cron** `relay-sync-office-bidirectional.sh` |
| Yard online | **Direct HTTPS** to office DB (no relay) |

## One-time VPS setup

```bash
# From dev machine
VPS=your.vps.ip bash scripts/relay/deploy-to-vps.sh

# On VPS
cp relay-installation.local.env.example /root/relay-installation.local.env
nano /root/relay-installation.local.env

bash /root/relay-clone-from-office.sh
sudo -u postgres psql -d drydock_sync_relay < /root/bucardo-relay-postgres-grants.sql

(crontab -l 2>/dev/null; echo "*/2 * * * * /root/relay-sync-office-bidirectional.sh >> /var/log/drydock-relay-sync.log 2>&1") | crontab -
```

## Office setup (after Prisma migrate)

```bash
bash scripts/relay/office-install-changed-at-triggers.sh
```

## Fleet node (ship / superintendent)

1. Install local PostgreSQL + run Prisma migrations.
2. Clone from relay (Bucardo init — Phase 3 scripts).
3. Register Bucardo dbgroups: `drydock_ship_to_relay`, `drydock_ship_from_relay`.
4. Set `projects.vessel_id` to match `VESSEL_ID` in relay env.

## Manifest

Table list: [bucardo-relay-manifest.txt](./bucardo-relay-manifest.txt)

Scope logic: [scripts/relay/relay-drydock-scope.sh](../../scripts/relay/relay-drydock-scope.sh)

## Logs

- VPS office sync: `/var/log/drydock-relay-sync.log`
- Bucardo: ship-local Bucardo logs

See also [ARCHITECTURE.md](./ARCHITECTURE.md).
