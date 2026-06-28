# Ship installation — Actinium-DD (local PostgreSQL + Bucardo)

## 1. PostgreSQL

Option A — Docker (recommended for pilot):

```bash
docker compose -f docker-compose.fleet.yml up -d
cp docs/sync/fleet.local.env.example fleet.local.env
# Edit VESSEL_ID and DATABASE_URL
export $(grep -v '^#' fleet.local.env | xargs)
npx prisma migrate deploy
```

Option B — Native PostgreSQL 16 on Windows: install from postgresql.org, create DB `actinium_dd`.

## 2. Bucardo

Install Bucardo on the ship PC (same as PMS fleet pilot). Then:

```bash
bash scripts/bucardo/ship-init.sh
```

Follow printed Bucardo `add database` / `add sync` commands.

## 3. Run desktop

```bash
npm run fleet:dev
```

This starts the local API (port 3847) and Tauri desktop.

## 4. Sync when in port

Ensure VPS relay is running and WireGuard/VPN to VPS is up. Bucardo pushes/pulls automatically.

See [RELAY-BUCARDO-RUNBOOK.md](./RELAY-BUCARDO-RUNBOOK.md).
