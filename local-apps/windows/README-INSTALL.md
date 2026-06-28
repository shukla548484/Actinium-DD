# Actinium-DD — Windows installation

Offline compare tool for superintendents and ship staff. Uses **local PostgreSQL**; syncs to office when online.

## Requirements

- Windows 10/11
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for PostgreSQL)
- Node.js 20+ (first-time setup only)

## Install (first time)

1. Copy this entire `windows/` folder to the ship PC (e.g. `C:\Actinium-DD\`).
2. Open **PowerShell as Administrator** and run:

```powershell
cd C:\Actinium-DD
Set-ExecutionPolicy -Scope Process Bypass
.\setup-postgres-windows.ps1
```

3. Edit `fleet.local.env` — set `VESSEL_ID` and `FLEET_ORIGIN_NODE=ship` or `superintendent`.
4. Double-click **`start-actinium-dd.bat`**.

## What's inside

| File | Purpose |
|------|---------|
| `Actinium-DD-setup.exe` / `.msi` | Desktop installer (after build) |
| `setup-postgres-windows.ps1` | Starts local PostgreSQL via Docker |
| `fleet.local.env` | Local DB URL + vessel ID |
| `start-actinium-dd.bat` | Starts database + API + app |

## Sync

See repo `docs/sync/INSTALL-SHIP.md` for Bucardo setup when in port.
