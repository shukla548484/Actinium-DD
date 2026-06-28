# Sync implementation phases

## Phase A — VPS relay + office bootstrap ✅ (scripts)

| Task | Done |
|------|------|
| `scripts/relay/office-bootstrap.sh` | ☑ |
| `scripts/relay/vps-bootstrap.sh` | ☑ |
| `scripts/sync/phase-a-deploy.sh` | ☑ |
| `npm run relay:office-bootstrap` | ☑ |
| `npm run sync:phase-a` | ☑ |
| Live VPS deploy (174.138.189.162) | ☐ Ops — SSH pending |

## Phase B — Mac / Windows local-apps folders ✅

| Task | Done |
|------|------|
| `local-apps/mac/` install + launcher | ☑ |
| `local-apps/windows/` install + launcher | ☑ |
| `npm run local-app:package` | ☑ |
| Built `.dmg` / `.msi` in folders | ☐ Run `desktop:build` on each OS |

## Phase C — Offline polish ✅

| Task | Done |
|------|------|
| `scripts/fleet-sidecar.mjs` (Postgres + API) | ☑ |
| `start-actinium-dd` launchers | ☑ |
| `npm run local-app:sidecar` / `local-app:launch` | ☑ |

## Phase D — Office authentication ✅

| Task | Done |
|------|------|
| `/login` + session cookie | ☑ |
| Middleware protects `/projects` + API | ☑ |
| `OFFICE_AUTH_PASSWORD` in `.env.example` | ☑ |
| Yard `/quote/*` stays public | ☑ |

## Phase E — Shipyard flow ✅

| Task | Done |
|------|------|
| Email yard via mailto on invite | ☑ |
| Submitted date in invite table | ☑ |
| Locked spec lines notice on yard portal | ☑ |
| Status workflow (shortlist/accept/reject) | ☑ (existing) |

## E2E validation

Run `npm run sync:checklist` — all items require live infrastructure.

---

## Phases F–K — RBAC + offline dual mode

**Master plan:** [PLATFORM-PLAN.md](./PLATFORM-PLAN.md)

Superintendents work **offline on local PostgreSQL**; when network is available, **Bucardo + VPS relay** sync to office. RBAC uses a **permission matrix** with **cached auth snapshots** on fleet devices — not live office calls per request.

| Phase | Focus | Status |
|-------|--------|--------|
| **F** | Identity & RBAC (office portal, online) | ☐ Partial — schema + 33 system roles seeded |
| **G** | Offline-first fleet node (local Postgres + sync) | ☐ Partial — sidecar + fleet API exist |
| **H** | RBAC on fleet nodes (device + auth snapshot) | ☐ |
| **I** | Approvals & monetary limits | ☐ |
| **J** | External users (shipyard, vendor, auditor) | ☐ Partial — yard token flow |
| **K** | Developer Admin / multi-tenant platform | ☐ |

### Parallel tracks (recommended)

1. **Track 1 — Phase F:** Users, org tenancy, permission checks on `/projects` API  
2. **Track 2 — Phase G:** Bucardo live, desktop 100% local DB, no office HTTP dependency  
3. **Merge — Phase H:** Auth snapshot sync, scoped offline login, audit push-up  

### Offline superintendent checklist (Phase G exit)

- [ ] Laptop disconnected — open project, edit spec, view comparison, export  
- [ ] Reconnect — changes visible on office portal within one sync cycle  
- [ ] Yard submits online while superintendent offline — comparison updates after pull  
- [ ] Sync panel shows offline / syncing / up to date / conflict states  
