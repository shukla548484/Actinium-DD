import type ExcelJS from "exceljs";
import {
  getQuoteExcelItemColumns,
  getQuoteExcelLayoutId,
  getPrimaryLineLabelKeysForLayout,
  getPrimaryLineLabelKeysForType,
  parseRequisitionTypeFromWorksheetText,
  QUOTE_EXCEL_LAYOUT_COLUMNS,
  type QuoteItemColumnDef,
  type QuoteItemColumnKey,
  QuoteExcelLayoutId,
} from "@/lib/excel-requisition-quote-schema";
import { RequisitionType } from "@/lib/types/requisition";

export type DetectedQuoteHeader = {
  headerRow: number;
  columns: QuoteItemColumnDef[];
  columnMap: Record<QuoteItemColumnKey, number>;
  serialColumn: number;
  requisitionType?: RequisitionType | null;
  layoutId?: QuoteExcelLayoutId;
};

export function normalizeHeaderLabel(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.:]/g, "")
    .replace(/\s+/g, " ");
}

export function isSerialHeader(label: string): boolean {
  return (
    label === "sno" ||
    label === "s no" ||
    label === "#" ||
    label.startsWith("s no")
  );
}

/** Must match labels from `QUOTE_EXCEL_LAYOUT_COLUMNS` / `generateRequisitionTemplate`. */
export function cellMatchesQuoteHeader(
  actual: unknown,
  colDef: QuoteItemColumnDef
): boolean {
  const a = normalizeHeaderLabel(actual);
  const expected = normalizeHeaderLabel(colDef.header);
  if (!a) return false;
  if (a === expected) return true;

  switch (colDef.key) {
    case "sno":
      return isSerialHeader(a);
    case "quantity":
      return (
        a === "qty" ||
        a === "quantity" ||
        a === "req qty" ||
        a.startsWith("qty (") ||
        a.startsWith("qty ")
      );
    case "unitPriceUsd":
      return a.includes("unit price") && a.includes("usd");
    case "unitPriceCurrency":
      return (
        a.includes("unit price") &&
        (a.includes("selected") || a.includes("currency"))
      );
    case "discount":
      return a.includes("disc") || a.includes("discount");
    case "totalPrice":
      return a === "total price" || a === "total";
    case "deliveryTime":
      return a.includes("delivery time") || a === "lead time";
    case "itemName":
      return a === "item name";
    case "oilGrade":
      return a === "oil grade";
    case "machinery":
      return a === "machinery";
    case "paintBrand":
      return a === "brand";
    case "paintProduct":
      return a === "product name";
    case "paintColorGrade":
      return a === "color grade";
    case "paintCategory":
      return a === "category";
    case "partNumber":
      return a === "part no" || a === "part number";
    case "partName":
      return a === "part name";
    case "itemNumber":
      return a === "item no" || a === "item number";
    case "drawingNumber":
      return a === "drawing no" || a === "drawing number";
    case "impaCode":
      return a.includes("impa");
    case "description":
      return a === "description";
    case "unit":
      return a === "unit" || a === "uom";
    case "urgency":
      return a === "urgency";
    case "remarks":
      return a === "remarks";
    default:
      return false;
  }
}

function rowMatchesColumnLayout(
  row: ExcelJS.Row,
  columns: QuoteItemColumnDef[]
): boolean {
  for (let i = 0; i < columns.length; i++) {
    const cellValue = row.getCell(i + 1).value;
    if (!cellMatchesQuoteHeader(cellValue, columns[i])) {
      return false;
    }
  }
  return true;
}

function buildDetectionResult(
  headerRow: number,
  columns: QuoteItemColumnDef[],
  requisitionType?: RequisitionType | null
): DetectedQuoteHeader {
  const columnMap = {} as Record<QuoteItemColumnKey, number>;
  columns.forEach((col, index) => {
    columnMap[col.key] = index + 1;
  });

  const layoutId = requisitionType
    ? getQuoteExcelLayoutId(requisitionType)
    : Object.values(QuoteExcelLayoutId).find(
        (id) =>
          QUOTE_EXCEL_LAYOUT_COLUMNS[id].map((c) => c.header).join("|") ===
          columns.map((c) => c.header).join("|")
      );

  return {
    headerRow,
    columns,
    columnMap,
    serialColumn: columnMap.sno ?? 1,
    requisitionType,
    layoutId,
  };
}

/** Read ReqType from schema marker row or "Requisition Type:" detail block. */
export function extractRequisitionTypeFromWorksheet(
  worksheet: ExcelJS.Worksheet
): RequisitionType | null {
  const maxRow = Math.min(50, worksheet.rowCount || 50);

  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    let rowText = "";

    row.eachCell((cell) => {
      if (cell.value) rowText += ` ${String(cell.value)}`;
    });

    const fromMarker = parseRequisitionTypeFromWorksheetText(rowText);
    if (fromMarker) return fromMarker;

    const cells: Array<{ col: number; text: string }> = [];
    row.eachCell((cell, colNumber) => {
      cells.push({ col: colNumber, text: normalizeHeaderLabel(cell.value) });
    });

    for (const cell of cells) {
      if (cell.text !== "requisition type") continue;
      const valueCell = row.getCell(cell.col + 1).value;
      const code = String(valueCell ?? "")
        .trim()
        .toUpperCase();
      if (Object.values(RequisitionType).includes(code as RequisitionType)) {
        return code as RequisitionType;
      }
    }
  }

  return null;
}

function uniqueColumnLayouts(): QuoteItemColumnDef[][] {
  const seen = new Set<string>();
  const layouts: QuoteItemColumnDef[][] = [];
  for (const layoutId of Object.values(QuoteExcelLayoutId)) {
    const columns = QUOTE_EXCEL_LAYOUT_COLUMNS[layoutId];
    const key = columns.map((c) => c.header).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    layouts.push(columns);
  }
  return layouts;
}

/**
 * Detect item table header using schema marker / requisition type first,
 * then fall back to matching any known layout profile.
 */
export function detectActiniumQuoteHeaderRow(
  worksheet: ExcelJS.Worksheet
): DetectedQuoteHeader | null {
  const maxRow = Math.min(120, worksheet.rowCount || 120);
  const requisitionType = extractRequisitionTypeFromWorksheet(worksheet);

  if (requisitionType) {
    const columns = getQuoteExcelItemColumns(requisitionType);
    for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      if (!isSerialHeader(normalizeHeaderLabel(row.getCell(1).value))) continue;
      if (rowMatchesColumnLayout(row, columns)) {
        return buildDetectionResult(rowNum, columns, requisitionType);
      }
    }
  }

  for (let rowNum = 1; rowNum <= maxRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    if (!isSerialHeader(normalizeHeaderLabel(row.getCell(1).value))) continue;

    for (const columns of uniqueColumnLayouts()) {
      if (!rowMatchesColumnLayout(row, columns)) continue;
      return buildDetectionResult(rowNum, columns, requisitionType);
    }
  }

  return null;
}

export function getPrimaryItemLabelFromRow(
  row: ExcelJS.Row,
  columnMap: Record<QuoteItemColumnKey, number>,
  layoutId?: QuoteExcelLayoutId | null,
  requisitionType?: RequisitionType | null
): string {
  const keys =
    layoutId != null
      ? getPrimaryLineLabelKeysForLayout(layoutId)
      : requisitionType
        ? getPrimaryLineLabelKeysForType(requisitionType)
        : (["oilGrade", "paintProduct", "partName", "itemName"] as const);

  for (const key of keys) {
    const idx = columnMap[key];
    if (!idx) continue;
    const value = row.getCell(idx).value;
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

export function isQuoteItemDataTerminatorRow(row: ExcelJS.Row): boolean {
  let labelText = "";
  row.eachCell((cell) => {
    if (!cell.value) return;
    const text = String(cell.value).trim();
    if (!labelText) labelText = text;
    const lower = text.toLowerCase();
    if (
      lower.includes("final gross total") ||
      lower.includes("final net total") ||
      (lower.includes("gross total") && lower.includes("discount")) ||
      lower.includes("commercial confirmation")
    ) {
      labelText = text;
    }
  });
  const lower = labelText.toLowerCase();
  return (
    lower.includes("final gross total") ||
    lower.includes("final net total") ||
    lower.includes("commercial confirmation")
  );
}

export {
  QuoteExcelLayoutId,
  buildQuoteExcelTypeRegistry,
  getQuoteExcelLayoutId,
} from "@/lib/excel-requisition-quote-schema";
