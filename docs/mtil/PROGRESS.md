# Actinium-SM Marine Technical Intelligence Library (MTIL)

**Version:** 0.2.0  
**Status:** Phase 3 complete — Phase 4 pending  
**Last updated:** 2026-07-05

TXT documentation trail: `docs/mtil/*.txt`

---

## Phase 1 Summary

| Metric | Count |
|--------|-------|
| Standardized jobs (generated) | **620** |
| Catalog templates (TMP-ENG-ME) | **25** |
| Supplemental templates | **8** |
| Systems | **16** |
| Components | **101** |
| Measurements (with tolerances) | **27** |
| Checklist items | **106** |

---

## Phase 2 Summary

Two complementary libraries are included:

### A) Generated matrix (v0.2 engine)

| Metric | Count |
|--------|-------|
| Standardized jobs | **458** |
| Catalog templates (TMP-AUX-AE/BLR) | **25 + 9 supplemental** |
| Systems | **11** |
| Components | **80** |
| Measurements | **14** |
| Checklist items | **70** |

### B) Engineering Repository workbook (v0.5)

Source: `data/mtil/Actinium_SM_MTIL_Phase_2_Auxiliary_Machinery_v0.5.xlsx`

| Metric | Count |
|--------|-------|
| Curated jobs (JOB-ENG-AUX) | **187** |
| Dynamic templates (TMP-ENG-AUX) | **12** |
| Measurements | **48** |
| Checklist items | **84** |
| Scope steps | **108** |
| Spare mappings | **700** |

Machinery: Diesel Generator, Boiler/Economizer, FWG, Purifier, Air Compressor, Heat Exchanger, OWS, Incinerator, Steering Gear, Hydraulic Power Pack, Refrigeration/HVAC, STP.

**Combined Phase 2 total: 645 jobs**

Seed: `POST /api/admin/mtil/phase2?source=all`  
v0.5 CSV: `GET /api/admin/mtil/phase2?format=csv&source=v05&sheet=jobs`

---

## Phase 3 Summary

| Metric | Count |
|--------|-------|
| Standardized jobs (generated) | **532** |
| Catalog templates (TMP-PVP-PMP) | **25** |
| Supplemental templates | **7** |
| Systems | **15** |
| Components | **85** |
| Measurements | **12** |
| Checklist items | **~70** |

---

## Workbook Export (Excel authoring)

| Sheet | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| Jobs | `/api/admin/mtil/phase1?format=csv&sheet=jobs` | `/api/admin/mtil/phase2?...` | `/api/admin/mtil/phase3?...` |
| Templates | `...&sheet=templates` | same | same |
| Measurements | `...&sheet=measurements` | same | same |
| Checklists | `...&sheet=checklists` | same | same |
| Scope | `...&sheet=scope` | same | same |
| Spares | `...&sheet=spares` | same | same |

Also available from **Admin → Job Library** MTIL panel.

---

## Phased Delivery Plan

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Standards, IDs, naming conventions, workbook schemas | ✅ Completed |
| 1 | Main Propulsion Systems | ✅ Completed |
| 2 | Auxiliary Machinery | ✅ Completed |
| 3 | Pumps, Valves & Piping | ✅ Completed |
| 4 | Deck Machinery & Cargo Systems | ⬜ Pending |
| 5 | Hull, Steel & Coatings | ⬜ Pending |
| 6 | Electrical, Automation & Navigation | ⬜ Pending |
| 7 | Safety & Accommodation | ⬜ Pending |
| 8 | Dynamic Templates (cross-cutting expansion) | 🔄 In progress |
| 9 | RFQ, Cost Codes & Quote Mapping | ⬜ Pending |
| 10 | AI Knowledge Base & Final Database | ⬜ Pending |

**Combined total:** 1,797 generated jobs (Phases 1–3, incl. Phase 2 v0.5 workbook)

---

## Next Deliverable

**Phase 4: Deck Machinery & Cargo Systems** — same engine pattern in `lib/mtil/phases/phase4/`.
