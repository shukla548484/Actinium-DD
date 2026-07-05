# MTIL Phase 1 — Excel Workbook (v0.2)

Four CSV sheets — open in Excel for authoring and review.

## Download

| Sheet | URL |
|-------|-----|
| Jobs (620 rows) | `/api/admin/mtil/phase1?format=csv&sheet=jobs` |
| Templates (25 rows) | `/api/admin/mtil/phase1?format=csv&sheet=templates` |
| Measurements (27 rows) | `/api/admin/mtil/phase1?format=csv&sheet=measurements` |
| Checklists (106 rows) | `/api/admin/mtil/phase1?format=csv&sheet=checklists` |

## Job sheet columns (v0.2)

Job ID · MTIL Internal Code · Phase · Department · System · Machinery · Component · Sub Component · Action · Standard Job Name · Workshop · Dynamic Template ID · Template Key · Vessel/Project applicability · Priority · Manhours · Class/QA-QC/Permit flags · Approval workflow · Attachments · Photos · Reports · Measurements · Checklists · RFQ/Budget codes

## ID formats

- Jobs: `JOB-ENG-ME-0001`
- Templates: `TMP-ENG-ME-0001`
- Measurements: `MEA-ENG-ME-0001`
- Inspections: `INS-ENG-ME-0001`
- Budget: `BUD-DD-ENG-0001`
- RFQ: `RFQ-ENG-ME-0001`

See `docs/mtil/STANDARDS.txt` and `docs/mtil/TEMPLATE-CATALOG.txt`.
