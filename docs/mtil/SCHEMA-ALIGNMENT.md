# MTIL ↔ Job Catalog Schema Alignment

**Version:** 0.2  
**Last updated:** 2026-07-05

This document confirms how MTIL Phase 1 maps to the Prisma **Job Catalog Library** schema (spreadsheet tabs 01–09).

## Schema layers

| Spreadsheet tab | Prisma model | MTIL source |
|-----------------|--------------|-------------|
| 01 Master Job Library | `MasterJobLibrary` | `generatePhase1JobDefinitions()` |
| 02 Dynamic Template Library | `JobDynamicTemplate` | `PHASE1_TEMPLATE_CATALOG` + supplemental |
| 03 Measurement Library | `JobMeasurement` | `MTIL_PHASE1_MEASUREMENTS` |
| 04 Inspection Checklist | `JobChecklistItem` | `MTIL_PHASE1_CHECKLISTS` |
| 05 Scope of Work | `JobScopeStep` | Checklist-derived scope steps per template |
| 06 Attachments / Photos | `JobAttachmentRequirement` | template photo/attachment/report slots |
| 07 Spares / Materials | `JobSpareMapping` | Overhaul/renew jobs via `sparesLibrary.ts` |
| 08 RFQ / Budget Mapping | `JobRfqBudgetMapping` | `defaultRfqMapping` / `defaultBudgetMapping` |
| 09 Workflow / Roles | `JobApprovalWorkflow` | `WF-ENG-ME-STANDARD` |

## JobDynamicTemplate JSON fields

| DB column | MTIL mapping |
|-----------|--------------|
| `template_id` | `TMP-ENG-ME-xxxx` from `buildTemplateId()` |
| `form_sections` | Standard sections: condition, repair, risk, approval |
| `auto_fill_fields` | Template `autoFill[]` → vessel/machinery/project paths |
| `manual_input_fields` | Resolved from `resolveDynamicTemplate()` minus auto-fill |
| `required_photos` | Template `photoSlots[]` with mandatory flags |
| `required_attachments` | Template `requiredAttachments[]` |
| `measurement_set_id` | `MEA-ENG-ME-xxxx` (from template ID) |
| `checklist_id` | `INS-ENG-ME-xxxx` (from template ID) |
| `approval_workflow_id` | `WF-ENG-ME-STANDARD` |
| `ui_layout_type` | `card_tabs` (default) or `wizard` for trials |

## Runtime resolution order

1. `JobLibraryNode.dynamicTemplateKey` (e.g. `me_unit_overhaul`)
2. Lookup `TMP-ENG-ME-xxxx` via template catalog
3. Load `JobDynamicTemplate` + related measurements/checklists from DB
4. Fallback to code registry in `lib/mtil/dynamicTemplateEngine.ts`

## Seed flow

```
Admin → Seed Phase 1 to DB     → JobLibraryNode tree
Admin → Sync Job Catalog DB    → JobDynamicTemplate + MasterJobLibrary + child rows
```

API: `POST /api/admin/mtil/job-catalog`

Code: `lib/mtil/db/seedJobCatalogPhase1.ts`, `lib/mtil/db/mapToJobCatalog.ts`

| 10 Lists | `JobCatalogListItem` | Vessel types, project types, workshops, roles |

## ID alignment (catalogSchema convention)

| Type | Format | Example |
|------|--------|---------|
| Template | TMP-ENG-ME-xxxx | TMP-ENG-ME-0017 |
| Measurement set | MEA-ENG-ME-xxxx | MEA-ENG-ME-0017 |
| Checklist | INS-ENG-ME-xxxx | INS-ENG-ME-0017 |
| Scope of work | SOW-ENG-ME-xxxx | SOW-ENG-ME-0017 |
| Spare map | SPR-ENG-ME-xxxx-001 | Per job line |

## Deferred

- Template UI preview images
- Excel import pipeline into these tables
- Maker-specific spare part catalogs
