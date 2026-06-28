# Actinium-DD — Ship Desktop (Tauri)

Offline desktop app for dry-dock superintendents. Compare yard Excel quotes on board with **local PostgreSQL** synced via Bucardo + VPS relay.

See [docs/sync/ARCHITECTURE.md](../docs/sync/ARCHITECTURE.md) and [INSTALL-SHIP.md](../docs/sync/INSTALL-SHIP.md).

## What it does

- Runs as a native desktop app (Windows, macOS, Linux)
- Stores projects in **local PostgreSQL** (same schema as office)
- Syncs to office via VPS relay when online (Bucardo)
- Reuses the same compare engine as the web tool:
  - Hull paint (zones, prep, area estimates)
  - Dry dock days & hire cost
  - Yard services
  - General service matching
- Auto-saves project state to `compare_snapshots`
- Export comparison Excel files from the app

## Prerequisites

1. **Node.js** 20+
2. **Rust** — [install Rust](https://www.rust-lang.org/learn/get-started#installing-rust)
3. **Tauri prerequisites** — [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)
4. **PostgreSQL** — Docker (`npm run fleet:up`) or native install

On macOS:
```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Install & run

From the repo root:

```bash
npm install
npm run fleet:up          # start local PostgreSQL (port 5434)
cp docs/sync/fleet.local.env.example fleet.local.env
# Edit VESSEL_ID, DATABASE_URL
export $(grep -v '^#' fleet.local.env | xargs)
npm run fleet:migrate
npm run desktop:install
npm run fleet:dev         # local API + Tauri desktop
```

`fleet:dev` starts the local API on port 3847 and Tauri in one command.

## Build installer

```bash
npm run desktop:build
```

Output: `desktop/src-tauri/target/release/bundle/` (`.dmg`, `.msi`, `.AppImage`, etc.)

## Architecture

```
local-api/server.ts   # HTTP API → Prisma → local PostgreSQL
desktop/src/          # Tauri shell — project sidebar, auto-save
desktop/src/api/      # fleetClient.ts → localhost:3847

../components/        # Shared UI (QuoteCompareApp, SyncStatusPanel, …)
../lib/               # Shared domain logic (hull, dryDock, fleetProjects, …)
```

**Online portal** (Next.js at `/projects`) uses the same tables on office PostgreSQL. Yard invites at `/quote/[token]` write to office; Bucardo pulls to ship.

## No PWA

Native desktop app — better for ship laptops with no browser install policy and reliable offline file access.
