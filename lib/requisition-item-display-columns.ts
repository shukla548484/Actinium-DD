/**
 * UI table columns derived from the vendor quote Excel schema (single source of truth).
 * @see lib/excel-requisition-quote-schema.ts
 */

import {
  getQuoteExcelItemColumns,
  getQuoteExcelLayoutId,
  quoteItemCellValue,
  QuoteExcelLayoutId,
  type QuoteItemColumnDef,
  type QuoteItemColumnKey,
} from "@/lib/excel-requisition-quote-schema";

/** Bid-comparison left table: minimal columns per layout (comments/urgency via icons on name). */
const QUOTE_COMPARISON_LAYOUT_COLUMNS: Record<QuoteExcelLayoutId, QuoteItemColumnKey[]> = {
  [QuoteExcelLayoutId.STORE]: ["itemName", "impaCode"],
  [QuoteExcelLayoutId.SPARE]: ["partName", "itemNumber", "partNumber"],
  [QuoteExcelLayoutId.LUB]: ["oilGrade", "machinery"],
  [QuoteExcelLayoutId.PAINT]: ["paintBrand", "paintProduct", "paintColorGrade", "paintCategory"],
  [QuoteExcelLayoutId.CHEMICAL]: ["paintBrand", "paintProduct", "partNumber"],
};

const QUOTE_COMPARISON_HEADER_OVERRIDES: Partial<Record<QuoteItemColumnKey, string>> = {
  partName: "Item Name",
};
import { ITEM_URGENCY_LABELS, type ItemUrgency } from "@/lib/types/requisition";

const VENDOR_PRICING_KEYS = new Set<QuoteItemColumnKey>([
  "unitPriceUsd",
  "unitPriceCurrency",
  "discount",
  "totalPrice",
  "deliveryTime",
]);

export type RequisitionItemAttachmentRow = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type RequisitionItemDisplayRow = Parameters<typeof quoteItemCellValue>[0] & {
  quantityInLiters?: number | null;
  impaNumber?: string | null;
  currentRob?: number | null;
  attachments?: RequisitionItemAttachmentRow[];
};

/** Item columns for read-only UI tables (excludes S.No. and vendor pricing). */
export function getRequisitionItemDisplayColumns(
  requisitionType: string | null | undefined
): QuoteItemColumnDef[] {
  const type = (requisitionType || "STR").toUpperCase();
  return getQuoteExcelItemColumns(type).filter(
    (c) => c.key !== "sno" && !VENDOR_PRICING_KEYS.has(c.key)
  );
}

/** Primary label column on bid-comparison left table (hosts comment / attachment icons). */
export function getQuoteComparisonPrimaryLabelKey(
  requisitionType: string | null | undefined
): QuoteItemColumnKey {
  const layoutId = getQuoteExcelLayoutId(requisitionType || "STR");
  switch (layoutId) {
    case QuoteExcelLayoutId.SPARE:
      return "partName";
    case QuoteExcelLayoutId.LUB:
      return "oilGrade";
    case QuoteExcelLayoutId.PAINT:
      return "paintProduct";
    case QuoteExcelLayoutId.CHEMICAL:
      return "paintProduct";
    default:
      return "itemName";
  }
}

/** Middle columns on bid-comparison left table (before Qty / Updated Qty). */
export function getQuoteComparisonDetailColumns(
  requisitionType: string | null | undefined
): QuoteItemColumnDef[] {
  const type = requisitionType || "STR";
  const layoutId = getQuoteExcelLayoutId(type);
  const allCols = getQuoteExcelItemColumns(type);
  return QUOTE_COMPARISON_LAYOUT_COLUMNS[layoutId].map((key) => {
    const def = allCols.find((c) => c.key === key);
    const header = QUOTE_COMPARISON_HEADER_OVERRIDES[key] ?? def?.header ?? key;
    return def ? { ...def, header } : { key, header, width: 20, locked: true };
  });
}

export function getQuoteComparisonQuantityHeader(
  requisitionType: string | null | undefined
): string {
  const layoutId = getQuoteExcelLayoutId(requisitionType || "STR");
  if (layoutId === QuoteExcelLayoutId.SPARE) return "Qty Requested";
  if (layoutId === QuoteExcelLayoutId.LUB) return "Qty (L)";
  return (
    getRequisitionItemDisplayColumns(requisitionType).find((c) => c.key === "quantity")?.header ??
    "Qty"
  );
}

export function getQuoteComparisonLeftColumnCount(
  requisitionType: string | null | undefined
): number {
  // # + detail cols + Quantity + Updated Qty
  return 1 + getQuoteComparisonDetailColumns(requisitionType).length + 2;
}

export function getQuoteComparisonFooterColSpan(
  requisitionType: string | null | undefined
): number {
  return getQuoteComparisonLeftColumnCount(requisitionType) - 1;
}

export function formatRequisitionItemDisplayValue(
  item: RequisitionItemDisplayRow,
  key: QuoteItemColumnKey,
  rowIndex: number
): string {
  if (key === "oilGrade") {
    const v = item.oilGrade?.trim() || item.itemName?.trim() || "";
    return v || "—";
  }
  if (key === "quantity") {
    const qty =
      item.quantityInLiters != null && item.quantityInLiters > 0
        ? item.quantityInLiters
        : item.quantity;
    if (qty == null || Number(qty) === 0) return "—";
    return String(qty);
  }
  if (key === "urgency") {
    const u = String(quoteItemCellValue(item, key, rowIndex) || "");
    if (!u || u === "NORMAL") return ITEM_URGENCY_LABELS.NORMAL;
    return ITEM_URGENCY_LABELS[u as ItemUrgency] ?? u;
  }
  const val = quoteItemCellValue(item, key, rowIndex);
  if (val === "" || val === 0) return "—";
  return String(val);
}

export function getRequisitionItemHeaderLabel(
  requisitionType: string | null | undefined,
  key: QuoteItemColumnKey
): string | undefined {
  return getRequisitionItemDisplayColumns(requisitionType).find((c) => c.key === key)
    ?.header;
}

export function showSpareCurrentRobColumn(requisitionType: string | null | undefined): boolean {
  return getQuoteExcelLayoutId(requisitionType || "STR") === QuoteExcelLayoutId.SPARE;
}
