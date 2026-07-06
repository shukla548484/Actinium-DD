# Shipyard Portal ERP — Master Plan

This document defines the **Shipyard Project Management ERP** module: workflow, navigation, data hierarchy, pages/API mapping, and phased build order.

## Design philosophy

Build as **Project Management ERP**, not isolated job CRUD.

```
Shipyard
  └── Project (tender Project + YardWorkProject)
        └── Contract (award / accepted YardInvite)
              └── RFQ (YardInvite queue)
                    └── Quotation (QuoteMeta + QuoteLine)
                          └── Work Package (spec bucket / workshop group)
                                └── Job (WorkshopJob ↔ DdJob)
                                      └── Activity
                                            └── Task
                                                  └── Daily Progress
```

## Office → Shipyard RFQ assignment

When office sends RFQ from **Projects → Yards** (`POST /api/projects/[id]/yards`):

1. Creates `yard_invites` row with token
2. Sets tender `Project.status` → `tendering`
3. Shipyard **RFQ Inbox** (`/shipyard/rfq`) lists invite as queue item
4. Workflow stage inferred from invite status (later: `yard_invites.workflow_stage` column)

After **award** (`YardInvite.status = accepted`):

1. Appears in **Awarded Projects** (`/shipyard/awarded`)
2. `POST /api/shipyard/projects/[projectId]/execution` seeds `WorkshopJob` from `SpecLine`
3. Superintendent dry dock workspace syncs via `shipyardSync` (`DdJob` ↔ `WorkshopJob`)

## Workflow lifecycle (left navigation)

| # | Module | Route | Phase | Status |
|---|--------|-------|-------|--------|
| — | Dashboard | `/shipyard` | Foundation | partial |
| 1 | Shipyard Profile | `/shipyard/profile` | Foundation | scaffold |
| 2 | RFQ Inbox | `/shipyard/rfq` | Pre-award | **partial (live queue)** |
| 3 | Cost Estimation | `/shipyard/estimation` | Pre-award | scaffold |
| 4 | Internal Approval | `/shipyard/approvals` | Pre-award | scaffold |
| 5 | Quote Builder | `/shipyard/quotation` | Pre-award | partial |
| 6 | Awarded Projects | `/shipyard/awarded` | Post-award | partial |
| 7 | Project Planning | `/shipyard/planning` | Post-award | partial |
| 8 | Resource Allocation | `/shipyard/planning/resources` | Post-award | scaffold |
| 9 | Material Planning | `/shipyard/materials` | Post-award | scaffold |
| 10 | Daily Progress | `/shipyard/execution/progress` | Post-award | **live** |
| 11 | Variation Orders | `/shipyard/commercial/variations` | Post-award | **live** |
| 12 | Workshop Production | `/shipyard/workshops` | Post-award | **live** |
| 13 | QA / QC | `/shipyard/qa` | Post-award | partial |
| 14 | Billing | `/shipyard/billing` | Post-award | scaffold |
| 15 | Project Closeout | `/shipyard/closeout` | Post-award | scaffold |

Registry: `lib/shipyard/workflow.ts` · API map: `lib/shipyard/apiRegistry.ts`

## Recommended build sequence

1. **Dashboard** — KPIs per user spec (projects waiting RFQ, running today, workers, utilization)
2. **Shipyard Profile** — docks, workshops, cranes, capacity calendar
3. **RFQ Inbox** — workflow stage transitions, estimator assignment, due dates
4. **Cost Estimation** — per-job cost component roll-up
5. **Quote Builder** — PDF output, commercial terms
6. **Project Planning** — Gantt, critical path (extend existing dependencies)
7. **Workshop Execution** — existing job boards
8. **Daily Progress / Variations / QA** — extend registers
9. **Billing & Closeout**

## Phase 2 schema (planned tables)

| Table | Purpose |
|-------|---------|
| `yard_docks` | Dock No, type, LOA, beam, draft, capacity |
| `yard_workshops` | Workshop capabilities linked to `Company` |
| `yard_cranes` | Crane capacity, radius, certification |
| `yard_capacity_calendar` | Monthly berth/dock occupancy |
| `yard_cost_estimates` | Per-invite cost build-up header |
| `yard_cost_estimate_lines` | Labour, material, equipment per spec line |
| `yard_approval_steps` | Internal approval chain |
| `yard_resource_allocations` | Crew/trade allocation |
| `yard_material_plans` | Material reservation |
| `yard_invoices` | Progress / final billing |
| `yard_closeout_checklists` | Closeout gate items |

**Extend existing:**

- `yard_invites` — add `workflow_stage`, `due_date`, `priority`, `assigned_estimator_id`, `yard_company_id`
- `yard_work_projects` — link `yard_company_id` to `companies`

## Pages ↔ API reference (live today)

| Page | API | Tables |
|------|-----|--------|
| RFQ Inbox | `GET /api/shipyard/rfq` | `yard_invites`, `projects` |
| Office RFQ send | `POST /api/projects/[id]/yards` | `yard_invites` |
| Quote portal | `GET/POST /api/quote/[token]` | `quote_meta`, `quote_lines` |
| Execution init | `POST /api/shipyard/projects/[id]/execution` | `yard_work_projects`, `workshop_jobs` |
| Job board | `GET/PATCH /api/shipyard/jobs/[id]` | `workshop_jobs` |
| Registers | `/api/shipyard/projects/[id]/registers/*` | `yard_daily_progress`, etc. |
| Dry dock sync | `POST /api/superintendent/projects/[id]/shipyard/sync` | `dd_jobs`, `workshop_jobs` |

## Module 1 — Shipyard Profile (screen spec)

- General: name, logo, country, port, address, website, established year
- Dock types: floating, graving, syncrolift, repair berths
- Infrastructure tables: docks, workshops, cranes, equipment
- **Dry dock capacity calendar** — monthly grid per dock/berth (not simple date list)

## Module 2 — RFQ Inbox (screen spec)

Columns: RFQ ref, Received, Waiting, Due date, Status, Priority, Vessel, Docking window, Attachments.

Actions: Review → Assign estimator → Open estimation → Submit quotation.

## Dashboard (home screen target)

```
Current Projects | Projects Waiting RFQ | Running Today | Delayed Jobs
Workers Today | Equipment Utilization
Projects Timeline | Today's Critical Jobs | Project Progress %
Variation Orders (pending/approved/rejected) | Invoices (pending/paid/overdue)
```

---

*Implementation: dashboard, profile, RFQ workflow, multi-version cost estimation with general services + owner cost templates. Next: internal approval + quote builder (use selected version ★).*
