# RBAC Job Scope — Gap Analysis & Phased Implementation Plan

> **Status:** Designation catalog updated (Role ID 1001–6019, job scope, approval level, reports-to).  
> **Next:** Map job scopes → pages → APIs → modules → database, then implement phase by phase.

---

## 1. Designation catalog (now in database)

Each role row stores:

| Field | Example | Meaning |
|-------|---------|---------|
| `roleNo` | `4001` | Spreadsheet **Role ID** |
| `hierarchyLevel` | `4` | **Tier** 1–6 (1000s=1 … 6000s=6) |
| `categoryTier` | `office` | Category band |
| `approvalLevel` | `3` | Sign-off authority 1–5 |
| `reportsToCode` | `TECH_MGR` | Reporting line |
| `jobScope` | text | Full job scope from catalog |

**48 roles** across 6 tiers — seeded from `lib/rbac/roles.ts`. View at **Admin → Roles**.

Legacy codes retired: `DEV_ADMIN` → `SYS_ADMIN`, `SHIPYARD` → `YARD_PM`.

---

## 2. Portal surfaces (modules)

| Portal | Route prefix | User types | Primary job scopes |
|--------|--------------|------------|-------------------|
| **Platform / Admin** | `/admin`, `/platform` | system, office (admin roles) | Platform config, org master data, RBAC |
| **Tender / Projects** | `/projects` | office | Tendering, spec, yards, comparison |
| **Superintendent / Dry dock** | `/superintendent` | office | DD planning, scope, budget, monitoring |
| **Ship Access (vessel)** | `/ship-access` | vessel | Jobs, defects, purchase, machinery |
| **Shipyard execution** | `/shipyard` | external (yard roles)* | Workshops, planning, execution |
| **External / Vendor** | `/external`, `/quote` | external | RFQs, quotes, class/owner access |
| **Desktop / Sync** | desktop app | office, vessel | Offline jobs, sync status |

\*Spreadsheet classifies YARD_* as **External** user type; shipyard portal routes remain the execution UI until unified.

---

## 3. Gap analysis — what exists vs missing

### Legend
- ✅ Built (pages + API + DB)
- 🟡 Partial (some layers only)
- ❌ Not started

### 3.1 System roles (1000s)

| Role | Job scope summary | Pages | API | DB | Status |
|------|-------------------|-------|-----|-----|--------|
| SYS_ADMIN | Platform, licensing, security | `/admin/*` 🟡 | `/api/admin/*` 🟡 | roles, permissions ✅ | 🟡 RBAC not enforced on admin yet |
| SYS_OFF | Company onboarding, modules | `/admin/*` 🟡 | same | companies ✅ | 🟡 |
| SYS_OPERATOR | Sync, imports, queues | — | `/api/sync` 🟡 | sync tables ✅ | 🟡 No ops UI |
| SYS_MONITOR | Infra, alerts, audit | — | stats 🟡 | audit ❌ | ❌ Monitoring dashboard |

### 3.2 Company & department (2000s–3000s)

| Area | Job scope | Pages | API | DB | Status |
|------|-----------|-------|-----|-----|--------|
| **Admin org master** | Companies, vessels, employees, vendors | `/admin/*` ✅ | `/api/admin/*` ✅ | Company, Vessel, Employee ✅ | ✅ |
| **Executive dashboards** | MD/Tech Dir approvals, budgets | — | — | — | ❌ |
| **Fleet KPIs** | Fleet Manager performance | — | — | — | ❌ |
| **HSEQ** | ISM, audits, incidents | — | — | — | ❌ |
| **Crewing** | Certifications, manpower | — | — | — | ❌ |
| **Purchase strategy** | Vendor approval (dept) | — | — | — | ❌ |
| **Accounts control** | Invoices, budgets (dept) | — | — | — | ❌ |

### 3.3 Office operations (4000s)

| Role / area | Job scope | Pages | API | DB | Status |
|-------------|-----------|-------|-----|-----|--------|
| **TECH_SUPDT** | Dry dock planning, PMS, defects, class | `/superintendent/**` ✅ | `/api/superintendent/**` ✅ | DryDockProject, DdVesselJob ✅ | 🟡 Many sub-modules stubbed |
| **MAR_SUPDT** | Marine, PSC, cargo | `/superintendent` 🟡 | partial | VesselDefect 🟡 | 🟡 |
| **PUR_OFF** | RFQs, POs, delivery | `/superintendent/.../procurement` 🟡 | partial | VesselRequisition ✅ | 🟡 |
| **ACC_OFF** | Invoice verification | — | — | — | ❌ |
| **INV_CTRL** | Inventory, spares | `/superintendent/spares` 🟡 | partial | — | 🟡 |
| **DOC_CTRL** | Document control, certificates | `/superintendent/.../documents` 🟡 | partial | — | 🟡 |
| **Tender module** | Spec, yards, comparison | `/projects/**` ✅ | `/api/projects/**` ✅ | Project, Spec ✅ | ✅ |

### 3.4 Vessel (5000s)

| Area | Job scope | Pages | API | DB | Status |
|------|-----------|-------|-----|-----|--------|
| **Jobs / scope bank** | Create, update, view jobs | `/ship-access/jobs/**` ✅ | `/api/ship-access/jobs` ✅ | DdVesselJob ✅ | ✅ |
| **Machinery hours** | Running hours | `/ship-access/machinery-hours` ✅ | `/api/ship-access/machinery-hours` ✅ | VesselTechnicalProfile ✅ | ✅ |
| **Defects** | Defect reporting | `/ship-access/defects/**` 🟡 | `/api/ship-access/defects` 🟡 | VesselDefect ✅ | 🟡 |
| **Purchase / requisitions** | Ship-side procurement | `/ship-access/purchase/**` 🟡 | partial | VesselRequisition ✅ | 🟡 |
| **Master approvals** | Approve defects/requisitions | — | — | — | ❌ |
| **Crew page assignment** | Per-crew page ACL | `/admin/crew-credentials/.../pages` ✅ | ✅ | EmployeeCrewPageAccess ✅ | ✅ |
| **PMS** | Planned maintenance | — | — | — | ❌ |
| **Condition / hull** | Hull condition inputs | superintendent vessel inputs 🟡 | partial | — | 🟡 |

### 3.5 External / shipyard (6000s)

| Area | Job scope | Pages | API | DB | Status |
|------|-----------|-------|-----|-----|--------|
| **YARD_PM / planning** | Project execution, schedule | `/shipyard/**` 🟡 | `/api/shipyard` 🟡 | execution models 🟡 | 🟡 |
| **Workshop supervisors** | Hull, steel, paint, mach, elec, pipe | `/shipyard/workshops` 🟡 | workshop-scoped 🟡 | — | 🟡 |
| **QA / Safety / Commercial** | Inspections, permits, variations | `/shipyard/execution`, `/commercial` 🟡 | partial | — | 🟡 |
| **Vendors / service** | Supply, specialist services | `/external`, `/quote/[token]` 🟡 | quote API 🟡 | — | 🟡 |
| **Class / Flag** | Surveys, statutory | — | — | — | ❌ |
| **Owner rep / supt** | Owner decisions | — | read-only project 🟡 | — | ❌ |
| **Auditor** | External audit | — | audit.read perm only | — | ❌ |

---

## 4. Database inventory (existing models)

| Domain | Prisma models | Used by |
|--------|---------------|---------|
| **Org / RBAC** | Company, Vessel, Employee, User, Role, Permission, RolePermission, UserRole, EmployeeCrewPageAccess | Admin, auth |
| **Tender** | Project, ProjectCategory, SpecLine, YardInvite, Quote… | `/projects` |
| **Dry dock** | DryDockProject, DdVesselJob, DdVesselJobLine… | Superintendent, ship-access |
| **Vessel ops** | VesselDefect, VesselRequisition, VesselTechnicalProfile | Ship-access, superintendent |
| **Shipyard exec** | (yard job boards — partial) | `/shipyard` |
| **Sync** | SyncDevice, tombstones, changed_at | Fleet desktop, relay |
| **Missing** | AuditLog, Inventory/Spares, PO/Invoice, PMS, Certificates, HSEQ incidents, Approval workflow | Future phases |

---

## 5. Phased implementation roadmap

### Phase A — Foundation (current sprint) ✅
**Goal:** Authoritative designation catalog in DB.

- [x] Role ID 1001–6019, tier, approval level, reports-to, job scope
- [x] Prisma schema + migration + seed
- [x] Admin → Roles shows Role ID, tier, approval, job scope
- [x] Designation picker shows `4001 · L4 · A3 · Technical Superintendent`
- [x] Enforce RBAC on `/admin` (COMP_ADMIN / SYS_ADMIN only)
- [x] Employee list/detail shows Role ID + approval level

### Phase B — Page catalog & job-scope matrix ✅ (foundation)
**Goal:** Map every job scope bullet → page permission key.

- [x] Add `page.*` permissions for missing modules (procurement, documents, HSEQ, accounts…)
- [x] New admin screen: **Job scope matrix** (role × module × page) — job scope preview + suggestions on `/admin/access`
- [x] Auto-suggest default pages from `jobScope` keywords (`lib/rbac/jobScopePages.ts`)
- [x] Wire `canAccessPage()` in layout guards for all office portals (middleware sets `x-pathname`)
- [x] Approval level rules engine (`lib/rbac/approvalLevel.ts`)

**Deliverable:** `/admin/access` extended with job scope column + bulk assign by tier.

### Phase C — Superintendent core (TECH_SUPDT job scope) 🟡
**Goal:** Complete dry dock superintendent workflow.

| Feature | Pages | API | DB |
|---------|-------|-----|-----|
| Project dashboard | `/superintendent/projects/[id]` ✅ | ✅ RBAC | DryDockProject ✅ |
| Scope / job bank | scope, jobs ✅ | ✅ | DdVesselJob ✅ |
| Vessel inputs | inputs/vessel/** ✅ | ✅ | various ✅ |
| Budget / variations | budget/** ✅ | ✅ RBAC | BudgetLine ✅ |
| Procurement / RFQ | procurement ✅ | ✅ RBAC + VesselRequisition | VesselRequisition ✅ |
| Monitoring / daily reports | monitoring/** ✅ | ✅ RBAC | DailyReport ✅ |
| Closeout | closeout ✅ | ✅ RBAC | — |

### Phase D — Vessel portal completion (5000s) ✅
**Goal:** Full ship-side job scope for ranks.

| Feature | Priority roles | Status |
|---------|----------------|--------|
| Jobs (CRUD + submit) | All ranks | ✅ |
| Machinery hours | CENG, 2ENG | ✅ |
| Defects (create, edit, master approve) | MASTER, CENG, COFF | ✅ |
| Purchase requisitions | MASTER, CENG | ✅ |
| Rank-based category filters | CE/2E/ETO/deck | ✅ |
| Admin-assigned page ACL | All crew | ✅ |
| PMS / condition reporting | CENG, COFF | ✅ PMS page + machinery condition |

### Phase E — Procurement & accounts (4000s PUR/ACC + 3000s) ✅
**Goal:** RFQ → quote → PO → invoice chain.

- [x] `/office/procurement` scaffold + permissions
- [x] `/office/accounts` scaffold + permissions
- [x] PO approval chain via `DdApprovalRequest` when status → issued
- [x] Invoice model and accounts verification UI
- [x] PUR_OFF, PUR_MGR, ACC_OFF, ACC_MGR page bundles
- [x] Vendor portal quote submission enhancement (`/external/quotes` + invite email matching)

### Phase F — Shipyard execution (6000s YARD_*) ✅
**Goal:** Workshop-scoped job boards per spreadsheet.

- [x] YARD_PM: `/shipyard` dashboard (existing + RBAC layout guard)
- [x] Workshop roles: interactive job boards + workshop-scoped RBAC on APIs
- [x] YARD_QA / Safety registers (permits, inspections) with API auth
- [x] Resolve user type: external vs shipyard portal routing (`lib/rbac/userTypes.ts` SHIPYARD_ROLE_CODES)

### Phase G — External parties (6000s CLASS/FLAG/OWNER/AUDITOR) ✅
**Goal:** Third-party read/submit portals.

- [x] Class / Flag / Owner / Auditor portal scaffolds (`/external/class`, etc.)
- [x] Survey read-only + oversight project list (data wiring via `/api/external/dashboard`)
- [x] Maker / Service vendor: service report jobs on external dashboard

### Phase H — Department modules (3000s managers) ✅
**Goal:** Department head dashboards.

- [x] Fleet Manager: `/office/fleet` with live KPIs
- [x] HSEQ Manager: `/office/hseq` with compliance counters
- [x] Crewing Manager: `/office/crewing` with manning stats
- [x] Tech/Marine Manager: superintendent approvals + workspace access

### Phase I — Executive & system (2000s–1000s) ✅
**Goal:** MD/Tech Dir approvals + platform ops.

- [x] Executive approval inbox scaffold (`/office/executive`)
- [x] Budget vs actual dashboard (`ExecutiveBudgetPanel` + `/api/office/dashboards/executive`)
- [x] SYS_MONITOR: `/platform/monitor` with audit log UI
- [x] SYS_OPERATOR: `/platform/operator` scaffold
- [x] Platform admin (`/platform`) for SYS_ADMIN

### Phase J — RBAC hardening & offline ✅
**Goal:** Production-ready authorization.

- [x] Enforce permissions on admin + superintendent API routes
- [x] Layout-level page RBAC for admin, projects, superintendent, shipyard
- [x] Cached auth snapshot for desktop/offline (`GET /api/auth/snapshot`)
- [x] Scope rules: vessel-assigned, project-assigned, yard-invite token (`lib/rbac/scopeRules.ts`, `/api/auth/scope`)
- [x] Audit log for mutations (invoices, POs, approvals; UI at `/platform/monitor`)

---

## 6. Recommended implementation order

```
Phase A (done) → Phase B (page matrix)
    → Phase D (vessel — high user visibility)
    → Phase C (superintendent — core business)
    → Phase F (shipyard workshops)
    → Phase E (procurement)
    → Phase G (external portals)
    → Phase H (department dashboards)
    → Phase I (executive + platform)
    → Phase J (hardening)
```

---

## 7. Immediate next steps (when you say go)

1. **Phase B start:** Extend `/admin/access` with job scope preview per role.
2. **Phase A finish:** Enforce admin RBAC; show Role ID on employee screens.
3. **Phase D:** Complete defects + purchase flows on ship-access with master approval.
4. **Phase C:** Wire superintendent procurement to VesselRequisition API end-to-end.

---

## 8. Reference — tier & approval summary

| Tier | Role ID range | Example | Approval levels |
|------|---------------|---------|-----------------|
| 1 System | 1001–1004 | SYS_ADMIN | 2–5 |
| 2 Company | 2001–2003 | COMP_ADMIN, MD | 5 |
| 3 Department | 3001–3007 | TECH_MGR | 4 |
| 4 Office | 4001–4006 | TECH_SUPDT | 2–3 |
| 5 Vessel | 5001–5009 | MASTER, CENG | 1–3 |
| 6 External | 6001–6019 | YARD_PM, CLASS | 1–3 |

**Approval level** (1–5) will drive the approval workflow in Phase E/I — higher number = authority to sign off larger decisions.
