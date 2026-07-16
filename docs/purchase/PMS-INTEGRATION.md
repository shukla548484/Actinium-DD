# Purchase Module (from app-pms-updated)

The full PMS purchase implementation is staged for integration:

| Path | Contents |
|------|----------|
| `vendor/pms-purchase-source/app-purchase/` | Original page.tsx UI (47 routes) |
| `vendor/pms-purchase-source/api/` | purchase, purchase-orders, requisitions, quotes, invoices, vendors, … |
| `vendor/pms-purchase-source/components/` | RequisitionForm, VendorForm, purchase budget charts, … |
| `vendor/pms-purchase-source/lib/` | purchase, procurement, services, types, session helpers |
| `vendor/pms-purchase-source/hooks/` | usePurchase*, useRequisitions*, … |

## Live in Actinium today

- Top nav **Purchase** + left sidebar with all PMS menu items (access levels preserved)
- Routes under `/purchase/*` (dashboard, requisitions, POs, invoices, vendors, budget, …)
- RBAC: `page.purchase.*` permissions; PUR_MGR / ACC_MGR / SYS_ADMIN
- Prisma models: `PurchaseVendor`, `PurchaseRequisition` (+ items), `PurchaseQuote` (+ items), `PurchaseOrder`, `PurchaseInvoice`
- Auth adapter: `lib/auth/purchaseAccess.ts` (session + vessel scope + access level)
- Data layer: `lib/db/purchase.ts`

### Live APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/purchase/dashboard/stats` | KPI counts / amounts |
| GET | `/api/purchase/vessels` | Vessel filter options |
| GET/POST | `/api/purchase/requisitions` | List + create (draft or submit) |
| POST | `/api/purchase/requisitions/template` | Quote-request Excel template |
| GET | `/api/purchase/requisition-subcategories/template` | Sub-category / budget Excel |
| GET | `/api/purchase/impa-codes/search` | IMPA catalogue search |
| GET | `/api/purchase/store-locations` | Vessel store locations (STR) |
| GET | `/api/purchase/machinery` | Vessel machinery assets (SPR) |
| POST | `/api/purchase/requisitions/[id]/items/[itemId]/attachments` | Line-item file upload |
| GET | `/api/purchase/vendors` | Vendor directory |
| GET | `/api/purchase/orders` | PO hub list |
| GET | `/api/purchase/invoices` | Invoice queue |

### Live UI pages

| Route | Panel |
|-------|--------|
| `/purchase/dashboard` | `PurchaseDashboardPanel` |
| `/purchase/view-requisitions` | `PurchaseRequisitionsPanel` |
| `/purchase/draft-requisitions` | same panel, status `NOT_READY` |
| `/purchase/create-requisition` | PMS-aligned create form (setup tabs, multi-item lines, draft/submit) |
| `/purchase/vendor-management` | `PurchaseVendorsPanel` |
| `/purchase/purchase-orders`, `/purchase/view-pos` | `PurchaseOrdersPanel` |
| `/purchase/invoices` | `PurchaseInvoicesPanel` |

Create requisition matches PMS layout: Requisition Information (Setup / Port Agent tabs), SETUP / DETAILS / BUDGET columns, multi-row items table, Cancel / Save as Draft / Create, plus:

- Live **IMPA catalog search** (`GET /api/purchase/impa-codes/search`) for STR / GLY / OTR / PRO / CHE
- **Excel templates** (quote request + sub-category budget sheets)
- **Line-item attachments** (PDF / JPEG / PNG via local upload after create)
- **Store-location** master for STR
- **SPR machinery** picker (vessel machinery register + manual name override)

Other sidebar routes still use `PurchaseFeaturePage` shells until ported.

### Sample data

```bash
npx tsx scripts/seed-purchase-sample.ts
```

Requires admin employee from `npm run db:seed` (`ACT.1001`). Seeds vendors, an approved requisition + draft, quote, PO, invoice, store locations, IMPA codes, and sample machinery (if the vessel has none).

## Follow-up (next updates)

1. Requisition detail / approve / RFQ send (from PMS `requisitions/[id]`)
2. Quote comparison + create PO flow
3. Invoice verification workbench
4. Budget control screens (`minAccessLevel` 28+)
5. Map PMS `designationAccessLevel` onto sidebar filtering in `app/purchase/layout.tsx` (sidebar already supports levels)
6. Full IMPA catalogue upload/admin (currently sample codes from seed)
7. Do **not** compile `vendor/` — port file-by-file with Base UI + Actinium auth
