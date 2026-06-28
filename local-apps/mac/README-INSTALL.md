# Actinium-DD — Mac installation

Offline compare tool for superintendents and ship staff. Uses **local PostgreSQL** on your Mac; syncs to office when online (Bucardo + VPS relay).

## Requirements

- macOS 12+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for PostgreSQL)
- Node.js 20+ (only for first-time setup — not needed after install if using `.app` bundle)

## Install (first time)

1. Copy this entire `mac/` folder to the ship Mac (e.g. `~/Actinium-DD/`).
2. Open **Terminal** and run:

```bash
cd ~/Actinium-DD   # or wherever you copied this folder
chmod +x setup-postgres-mac.sh start-actinium-dd.command
./setup-postgres-mac.sh
```

3. Edit `fleet.local.env` — set `VESSEL_ID` (must match office/relay) and `FLEET_ORIGIN_NODE=ship` or `superintendent`.
4. Double-click **`start-actinium-dd.command`** to launch.

## What's inside

| File | Purpose |
|------|---------|
| `Actinium-DD.dmg` / `.app` | Desktop application (after build) |
| `setup-postgres-mac.sh` | Starts local PostgreSQL via Docker |
| `fleet.local.env` | Local DB URL + vessel ID |
| `start-actinium-dd.command` | Starts database + API + app |

## Sync (when in port)

Ensure Bucardo is configured per `docs/sync/INSTALL-SHIP.md` in the repo. Data syncs automatically when VPN/network to VPS is available.

## Support

Office portal: `https://your-office-server/projects`  
Yard quotes: sent via `/quote/[token]` links (online only).
