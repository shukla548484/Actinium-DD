/**
 * Single source of truth for vendor quote Excel layouts.
 *
 * Outbound: `generateRequisitionTemplate` → `getQuoteExcelItemColumns(requisitionType)`
 * Inbound:  `parseQuoteResponseExcel` → `detectActiniumQuoteHeaderRow` (same columns)
 *
 * @see docs/procurement/QUOTE-EXCEL-SCHEMA.md
 */

import type { RequisitionItem } from "@prisma/client";
import { RequisitionType } from "@/lib/types/requisition";
import { columnLetterFromIndex } from "@/lib/excel-branding";

/** Bump when column order/headers change (embedded in every vendor Excel). */
export const QUOTE_EXCEL_SCHEMA_VERSION = "1";

/** Machine-readable marker prefix in generated workbooks. */
export const QUOTE_EXCEL_SCHEMA_MARKER = "Actinium Quote Schema";

export type QuoteItemColumnKey =
  | "sno"
  | "itemName"
  | "impaCode"
  | "partNumber"
  | "partName"
  | "itemNumber"
  | "drawingNumber"
  | "oilGrade"
  | "machinery"
  | "paintBrand"
  | "paintProduct"
  | "paintColorGrade"
  | "paintCategory"
  | "description"
  | "quantity"
  | "unit"
  | "urgency"
  | "remarks"
  | "unitPriceUsd"
  | "unitPriceCurrency"
  | "discount"
  | "totalPrice"
  | "deliveryTime";

export interface QuoteItemColumnDef {
  key: QuoteItemColumnKey;
  header: string;
  width: number;
  locked: boolean;
  editable?: boolean;
  calculated?: boolean;
  numFmt?: string;
}

/** Four distinct item-table layouts (vendor pricing columns are shared). */
export enum QuoteExcelLayoutId {
  /** Store, galley, provision, bunker, services, CTM, flag/class, other — IMPA-based lines */
  STORE = "STORE",
  /** Spares — part / drawing columns */
  SPARE = "SPARE",
  /** Lube oil — oil grade + machinery */
  LUB = "LUB",
  /** Paint — brand / product / color */
  PAINT = "PAINT",
  /** Chemicals — maker / product / product code */
  CHEMICAL = "CHEMICAL",
}

/** Keys used as the primary line label when linking quote rows to requisition items. */
export const PRIMARY_LINE_LABEL_KEYS: Record<
  QuoteExcelLayoutId,
  QuoteItemColumnKey[]
> = {
  [QuoteExcelLayoutId.STORE]: ["itemName"],
  [QuoteExcelLayoutId.SPARE]: ["partName", "partNumber", "itemName"],
  [QuoteExcelLayoutId.LUB]: ["oilGrade"],
  [QuoteExcelLayoutId.PAINT]: ["paintProduct", "paintBrand"],
  [QuoteExcelLayoutId.CHEMICAL]: ["paintProduct", "paintBrand", "partNumber"],
};

/** Vendor-editable pricing columns — identical on every layout. */
export const VENDOR_PRICING_COLUMNS: QuoteItemColumnDef[] = [
  {
    key: "unitPriceUsd",
    header: "Unit Price (USD)",
    width: 16,
    locked: true,
    numFmt: "#,##0.00",
  },
  {
    key: "unitPriceCurrency",
    header: "Unit Price (Selected)",
    width: 18,
    locked: false,
    editable: true,
    numFmt: "#,##0.00",
  },
  {
    key: "discount",
    header: "Disc. %",
    width: 10,
    locked: false,
    editable: true,
    numFmt: "0.00",
  },
  {
    key: "totalPrice",
    header: "Total Price",
    width: 16,
    locked: false,
    calculated: true,
    numFmt: "#,##0.00",
  },
  {
    key: "deliveryTime",
    header: "Delivery Time",
    width: 16,
    locked: false,
    editable: true,
  },
];

const SNO: QuoteItemColumnDef = {
  key: "sno",
  header: "S.No.",
  width: 5,
  locked: true,
};

const STORE_ITEM_COLUMNS: QuoteItemColumnDef[] = [
  SNO,
  { key: "itemName", header: "Item Name", width: 34, locked: true },
  { key: "impaCode", header: "IMPA Code", width: 16, locked: true },
  { key: "description", header: "Description", width: 28, locked: true },
  { key: "quantity", header: "Qty", width: 10, locked: true, numFmt: "#,##0.00" },
  { key: "unit", header: "Unit", width: 8, locked: true },
  { key: "urgency", header: "Urgency", width: 12, locked: true },
  { key: "remarks", header: "Remarks", width: 22, locked: true },
];

const SPARE_ITEM_COLUMNS: QuoteItemColumnDef[] = [
  SNO,
  { key: "partNumber", header: "Part No.", width: 14, locked: true },
  { key: "partName", header: "Part Name", width: 28, locked: true },
  { key: "itemNumber", header: "Item No.", width: 12, locked: true },
  { key: "drawingNumber", header: "Drawing No.", width: 14, locked: true },
  { key: "description", header: "Description", width: 28, locked: true },
  { key: "quantity", header: "Qty", width: 10, locked: true, numFmt: "#,##0.00" },
  { key: "unit", header: "Unit", width: 8, locked: true },
  { key: "urgency", header: "Urgency", width: 12, locked: true },
  { key: "remarks", header: "Remarks", width: 22, locked: true },
];

const LUB_ITEM_COLUMNS: QuoteItemColumnDef[] = [
  SNO,
  { key: "oilGrade", header: "Oil Grade", width: 22, locked: true },
  { key: "machinery", header: "Machinery", width: 24, locked: true },
  { key: "quantity", header: "Qty (L)", width: 10, locked: true, numFmt: "#,##0.00" },
  { key: "remarks", header: "Remarks", width: 24, locked: true },
];

const PAINT_ITEM_COLUMNS: QuoteItemColumnDef[] = [
  SNO,
  { key: "paintBrand", header: "Brand", width: 14, locked: true },
  { key: "paintProduct", header: "Product Name", width: 24, locked: true },
  { key: "paintColorGrade", header: "Color Grade", width: 14, locked: true },
  { key: "paintCategory", header: "Category", width: 14, locked: true },
  { key: "quantity", header: "Qty", width: 10, locked: true, numFmt: "#,##0.00" },
  { key: "unit", header: "Unit", width: 8, locked: true },
  { key: "remarks", header: "Remarks", width: 24, locked: true },
];

const CHEMICAL_ITEM_COLUMNS: QuoteItemColumnDef[] = [
  SNO,
  { key: "paintBrand", header: "Chemical Maker", width: 16, locked: true },
  { key: "paintProduct", header: "Product Name", width: 24, locked: true },
  { key: "partNumber", header: "Product Code", width: 14, locked: true },
  { key: "quantity", header: "Qty", width: 10, locked: true, numFmt: "#,##0.00" },
  { key: "unit", header: "Unit", width: 8, locked: true },
  { key: "remarks", header: "Remarks", width: 24, locked: true },
];

export const QUOTE_EXCEL_LAYOUT_COLUMNS: Record<
  QuoteExcelLayoutId,
  QuoteItemColumnDef[]
> = {
  [QuoteExcelLayoutId.STORE]: [...STORE_ITEM_COLUMNS, ...VENDOR_PRICING_COLUMNS],
  [QuoteExcelLayoutId.SPARE]: [...SPARE_ITEM_COLUMNS, ...VENDOR_PRICING_COLUMNS],
  [QuoteExcelLayoutId.LUB]: [...LUB_ITEM_COLUMNS, ...VENDOR_PRICING_COLUMNS],
  [QuoteExcelLayoutId.PAINT]: [...PAINT_ITEM_COLUMNS, ...VENDOR_PRICING_COLUMNS],
  [QuoteExcelLayoutId.CHEMICAL]: [...CHEMICAL_ITEM_COLUMNS, ...VENDOR_PRICING_COLUMNS],
};

/** Every DB requisition type → Excel layout profile. */
export const REQUISITION_TYPE_LAYOUT: Record<RequisitionType, QuoteExcelLayoutId> = {
  [RequisitionType.STR]: QuoteExcelLayoutId.STORE,
  [RequisitionType.GLY]: QuoteExcelLayoutId.STORE,
  [RequisitionType.PRO]: QuoteExcelLayoutId.STORE,
  [RequisitionType.REP]: QuoteExcelLayoutId.STORE,
  [RequisitionType.SER]: QuoteExcelLayoutId.STORE,
  [RequisitionType.CTM]: QuoteExcelLayoutId.STORE,
  [RequisitionType.BNK]: QuoteExcelLayoutId.STORE,
  [RequisitionType.FCL]: QuoteExcelLayoutId.STORE,
  [RequisitionType.OTR]: QuoteExcelLayoutId.STORE,
  [RequisitionType.CHE]: QuoteExcelLayoutId.CHEMICAL,
  [RequisitionType.SPR]: QuoteExcelLayoutId.SPARE,
  [RequisitionType.LUB]: QuoteExcelLayoutId.LUB,
  [RequisitionType.PNT]: QuoteExcelLayoutId.PAINT,
};

export type QuoteExcelTypeRegistryEntry = {
  requisitionType: RequisitionType;
  label: string;
  layoutId: QuoteExcelLayoutId;
  itemColumns: QuoteItemColumnDef[];
  /** Human note — tools/chemicals use STR subcategories, not separate types */
  notes?: string;
};

/** Full registry for docs, tests, and admin tooling. */
export function buildQuoteExcelTypeRegistry(): QuoteExcelTypeRegistryEntry[] {
  const labels: Record<RequisitionType, string> = {
    [RequisitionType.STR]: "Store Requisition (incl. tools, chemicals via subcategory)",
    [RequisitionType.SPR]: "Spares Requisition",
    [RequisitionType.GLY]: "Galley Requisition",
    [RequisitionType.PNT]: "Paint Requisition",
    [RequisitionType.REP]: "Repair Requisition Request",
    [RequisitionType.SER]: "Service Requisition Request",
  [RequisitionType.CTM]: "Cash to Master (CTM)",
    [RequisitionType.PRO]: "Provision Request",
    [RequisitionType.BNK]: "Bunker Request",
    [RequisitionType.LUB]: "Lube Oil Request",
    [RequisitionType.FCL]: "Flag/Class Request",
    [RequisitionType.OTR]: "Other Requisitions",
    [RequisitionType.CHE]: "Chemicals Requisition",
  };

  return (Object.values(RequisitionType) as RequisitionType[]).map((type) => {
    const layoutId = REQUISITION_TYPE_LAYOUT[type];
    const notesByType: Partial<Record<RequisitionType, string>> = {
      [RequisitionType.STR]:
        "Includes chemicals (STR-CHE), tools/workshop (STR-WKS), deck/engine/medical/safety stores. Subcategory does not change Excel columns.",
      [RequisitionType.GLY]:
        "Galley equipment, utensils, cleaning (GLY-EQP, GLY-UTL, etc.). Uses STORE Excel layout.",
      [RequisitionType.BNK]:
        "Bunker/fuel (BNK-HFO, BNK-MGO, BNK-VLSFO, BNK-LNG). Uses STORE layout (Item Name + Qty + Unit).",
      [RequisitionType.CTM]:
        "Cash to Master — amount/currency form; quote Excel uses STORE layout if vendor returns spreadsheet.",
      [RequisitionType.LUB]:
        "All lube subcategories (LUB-CYL, LUB-HYD, LUB-GRS, etc.) share LUB Excel layout.",
      [RequisitionType.PNT]:
        "Paint subcategories (PNT-HUL, PNT-DCK, PNT-INT Engine Paint, PNT-CHP, etc.) share PAINT Excel layout.",
      [RequisitionType.PRO]:
        "Provisions (food, dry stores, etc.). Uses STORE layout.",
      [RequisitionType.CHE]:
        "Chemical maker / product / product code columns (CHE-DCK, CHE-ENG, CHE-TCL, etc.).",
    };
    return {
      requisitionType: type,
      label: labels[type],
      layoutId,
      itemColumns: QUOTE_EXCEL_LAYOUT_COLUMNS[layoutId],
      notes: notesByType[type],
    };
  });
}

/**
 * How common business terms map to system requisition types (verified against DB subcategories).
 * Chemicals and tools are NOT separate top-level types.
 */
export const REQUISITION_COMMON_NAME_INDEX: Array<{
  commonName: string;
  requisitionType: RequisitionType;
  exampleSubCategory?: string;
  excelLayout: QuoteExcelLayoutId;
}> = [
  { commonName: "Chemicals", requisitionType: RequisitionType.CHE, exampleSubCategory: "CHE-DCK", excelLayout: QuoteExcelLayoutId.CHEMICAL },
  { commonName: "Tools / workshop stores", requisitionType: RequisitionType.STR, exampleSubCategory: "STR-WKS", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Deck / engine stores", requisitionType: RequisitionType.STR, exampleSubCategory: "STR-DCK / STR-ENG", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Galley", requisitionType: RequisitionType.GLY, exampleSubCategory: "GLY-EQP", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Provisions / food", requisitionType: RequisitionType.PRO, exampleSubCategory: "PRO-FOO", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Paint", requisitionType: RequisitionType.PNT, exampleSubCategory: "PNT-DCK", excelLayout: QuoteExcelLayoutId.PAINT },
  { commonName: "Lube oil / lubricants", requisitionType: RequisitionType.LUB, exampleSubCategory: "LUB-CYL", excelLayout: QuoteExcelLayoutId.LUB },
  { commonName: "Bunker / fuel", requisitionType: RequisitionType.BNK, exampleSubCategory: "BNK-MGO", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Cash to Master", requisitionType: RequisitionType.CTM, excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Spares", requisitionType: RequisitionType.SPR, exampleSubCategory: "SPR-MEN", excelLayout: QuoteExcelLayoutId.SPARE },
  { commonName: "Repair", requisitionType: RequisitionType.REP, excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Service", requisitionType: RequisitionType.SER, excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Flag / class survey", requisitionType: RequisitionType.FCL, exampleSubCategory: "FCL-CLS", excelLayout: QuoteExcelLayoutId.STORE },
  { commonName: "Other / miscellaneous", requisitionType: RequisitionType.OTR, excelLayout: QuoteExcelLayoutId.STORE },
];

export function getQuoteExcelLayoutId(
  requisitionType: string
): QuoteExcelLayoutId {
  const layout = REQUISITION_TYPE_LAYOUT[requisitionType as RequisitionType];
  return layout ?? QuoteExcelLayoutId.STORE;
}

/** Item table columns for a requisition type (template + parser). */
export function getQuoteExcelItemColumns(
  requisitionType: string
): QuoteItemColumnDef[] {
  return QUOTE_EXCEL_LAYOUT_COLUMNS[getQuoteExcelLayoutId(requisitionType)];
}

export function quoteItemColumnIndex(
  columns: QuoteItemColumnDef[],
  key: QuoteItemColumnKey
): number {
  const idx = columns.findIndex((c) => c.key === key);
  return idx >= 0 ? idx + 1 : -1;
}

export function quoteItemColumnLetter(
  columns: QuoteItemColumnDef[],
  key: QuoteItemColumnKey
): string | null {
  const idx = quoteItemColumnIndex(columns, key);
  return idx > 0 ? columnLetterFromIndex(idx) : null;
}

type ItemLike = RequisitionItem & {
  impaCode?: string | null;
  partName?: string | null;
  itemNumber?: string | null;
  oilGrade?: string | null;
  manualMachineryName?: string | null;
  paintBrand?: string | null;
  paintProductName?: string | null;
  paintColorGrade?: string | null;
  paintCategory?: string | null;
};

export function quoteItemCellValue(
  item: ItemLike,
  key: QuoteItemColumnKey,
  rowIndex: number
): string | number {
  switch (key) {
    case "sno":
      return rowIndex + 1;
    case "itemName":
      return item.itemName || "";
    case "impaCode":
      return item.impaNumber || item.impaCode || "";
    case "partNumber":
      return item.partNumber || "";
    case "partName":
      return item.partName || item.itemName || "";
    case "itemNumber":
      return item.itemNumber || "";
    case "drawingNumber":
      return item.drawingNumber || "";
    case "oilGrade":
      return item.oilGrade || "";
    case "machinery":
      return item.manualMachineryName || "";
    case "paintBrand":
      return item.paintBrand || "";
    case "paintProduct":
      return item.paintProductName || "";
    case "paintColorGrade":
      return item.paintColorGrade || "";
    case "paintCategory":
      return item.paintCategory || "";
    case "description":
      return item.description || "";
    case "quantity":
      return Number(item.quantity) || 0;
    case "unit":
      return item.unit || "";
    case "urgency":
      return item.urgency || "NORMAL";
    case "remarks":
      return item.remarks || "";
    default:
      return "";
  }
}

/** Text embedded in generated vendor Excel for reliable inbound parsing. */
export function formatQuoteExcelSchemaMarker(requisitionType: string): string {
  return `${QUOTE_EXCEL_SCHEMA_MARKER} v${QUOTE_EXCEL_SCHEMA_VERSION} | ReqType: ${requisitionType} | Layout: ${getQuoteExcelLayoutId(requisitionType)}`;
}

const REQUISITION_TYPE_CODES = new Set(
  Object.values(RequisitionType) as string[]
);

/** Parse ReqType from schema marker or "Requisition Type:" detail field. */
export function parseRequisitionTypeFromWorksheetText(
  text: string
): RequisitionType | null {
  const markerMatch = text.match(
    /ReqType:\s*([A-Z]{3})/i
  );
  if (markerMatch?.[1] && REQUISITION_TYPE_CODES.has(markerMatch[1].toUpperCase())) {
    return markerMatch[1].toUpperCase() as RequisitionType;
  }
  return null;
}

export function getPrimaryLineLabelKeysForType(
  requisitionType: string
): QuoteItemColumnKey[] {
  return PRIMARY_LINE_LABEL_KEYS[getQuoteExcelLayoutId(requisitionType)];
}

export function getPrimaryLineLabelKeysForLayout(
  layoutId: QuoteExcelLayoutId
): QuoteItemColumnKey[] {
  return PRIMARY_LINE_LABEL_KEYS[layoutId];
}
