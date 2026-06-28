/**
 * Resilient Excel parser — handles merged cells, multi-header formats,
 * blank-row gaps, and different column naming conventions that shipyards use.
 * This is our key differentiator vs portal-based tools.
 */
import * as XLSX from "xlsx";

export interface NormalizedRow {
  cells: string[];
  numbers: number[];
  rowIndex: number;
  isEmpty: boolean;
  isLikelyHeader: boolean;
  isMergedHeading: boolean;
  raw: unknown[];
}

export interface SheetParseResult {
  name: string;
  rows: NormalizedRow[];
  detectedHeaders: DetectedHeader[];
  mergedRegions: MergedRegion[];
  rawRows: unknown[][];
}

export interface DetectedHeader {
  rowIndex: number;
  columns: ColumnMapping;
  confidence: number;
}

export interface ColumnMapping {
  service: number;
  area: number;
  qty: number;
  unit: string;
  unitRate: number;
  total: number;
  currency: string;
}

export interface MergedRegion {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  value: string;
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  service: [
    "description", "item", "service", "scope", "work", "activity",
    "particular", "details", "job", "task", "specification", "spec",
    "nature of work", "work description", "job description", "sl no",
    "s.no", "s/n", "sn", "remarks", "name",
  ],
  area: [
    "area", "extent", "surface", "sqm", "m2", "m²", "square",
    "coverage", "painting area",
  ],
  qty: [
    "qty", "quantity", "units", "nos", "no.", "numbers", "pcs",
  ],
  unitRate: [
    "rate", "unit rate", "rate/m2", "rate/m²", "price/m2", "unit price",
    "per m2", "per sqm", "cost/m2", "price per unit", "u/price",
    "unit cost", "rate per sqm",
  ],
  total: [
    "total", "amount", "extended", "line total", "value", "net amount",
    "total price", "total cost", "sub total", "ext. amount", "total amt",
    "lumpsum", "lump sum", "ls",
  ],
};

const CURRENCY_PATTERNS: Record<string, RegExp> = {
  USD: /(?:USD|\$|US\$)/i,
  SGD: /(?:SGD|S\$)/i,
  EUR: /(?:EUR|€)/i,
  GBP: /(?:GBP|£)/i,
  CNY: /(?:CNY|RMB|¥)/i,
  AED: /(?:AED)/i,
  INR: /(?:INR|₹)/i,
};

const UNIT_PATTERNS: Record<string, RegExp> = {
  "m²": /\b(m2|m²|sqm|sq\.?\s*m|square\s*met)/i,
  "ft²": /\b(ft2|ft²|sq\.?\s*ft|square\s*f)/i,
  "day": /\b(day|days|per\s*day|\/day)/i,
  "hour": /\b(hour|hours|hr|hrs|\/hr)/i,
  "kg": /\b(kg|kgs|kilogram)/i,
  "ton": /\b(ton|tons|tonne|mt|metric\s*ton)/i,
  "lump": /\b(lump\s*sum|ls|l\.s\.?)/i,
  "lot": /\b(lot|set|job)/i,
};

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const text = cellText(value)
    .replace(/[,$\s€£¥₹]/g, "")
    .replace(/^[A-Z]{2,3}\s*/, "");
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function detectCurrency(rows: unknown[][]): string {
  const sample = rows.slice(0, 30).flat().map(cellText).join(" ");
  for (const [code, regex] of Object.entries(CURRENCY_PATTERNS)) {
    if (regex.test(sample)) return code;
  }
  return "USD";
}

function detectUnit(headerText: string, cellValues: string[]): string {
  const combined = [headerText, ...cellValues].join(" ");
  for (const [unit, regex] of Object.entries(UNIT_PATTERNS)) {
    if (regex.test(combined)) return unit;
  }
  return "unit";
}

function extractMergedRegions(sheet: XLSX.WorkSheet): MergedRegion[] {
  const merges = sheet["!merges"] ?? [];
  const regions: MergedRegion[] = [];

  for (const merge of merges) {
    const cellAddr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
    const cell = sheet[cellAddr];
    const value = cell ? cellText(cell.v) : "";
    regions.push({
      startRow: merge.s.r,
      endRow: merge.e.r,
      startCol: merge.s.c,
      endCol: merge.e.c,
      value,
    });
  }

  return regions;
}

function isHeaderRow(cells: string[]): boolean {
  const filled = cells.filter(Boolean);
  if (filled.length < 2) return false;

  const allSynonyms = Object.values(HEADER_SYNONYMS).flat();
  let hits = 0;
  for (const cell of filled) {
    const lower = cell.toLowerCase();
    if (allSynonyms.some((s) => lower.includes(s) || lower === s)) hits++;
  }
  return hits >= 2;
}

function isMergedHeading(
  row: unknown[],
  strings: string[],
  mergedRegions: MergedRegion[],
  rowIndex: number,
): boolean {
  const merge = mergedRegions.find(
    (m) => m.startRow === rowIndex && m.endCol - m.startCol >= 2,
  );
  if (merge && merge.value) return true;

  const filled = strings.filter(Boolean);
  if (filled.length === 1 && filled[0].length < 80) {
    const nums = row
      .map((c) => parseNumber(c))
      .filter((n): n is number => n !== undefined);
    if (nums.length === 0) return true;
  }
  return false;
}

function mapColumns(header: string[], rawRows: unknown[][]): ColumnMapping {
  const lower = header.map((h) => h.toLowerCase());

  const findCol = (category: string): number => {
    const synonyms = HEADER_SYNONYMS[category] ?? [];
    const idx = lower.findIndex((h) =>
      synonyms.some((s) => h.includes(s) || h === s),
    );
    return idx;
  };

  const serviceCol = findCol("service");
  const areaCol = findCol("area");
  const qtyCol = findCol("qty");
  const unitRateCol = findCol("unitRate");
  const totalCol = findCol("total");

  const unit = detectUnit(header.join(" "), []);
  const currency = detectCurrency(rawRows);

  return {
    service: serviceCol >= 0 ? serviceCol : 0,
    area: areaCol,
    qty: qtyCol,
    unit,
    unitRate: unitRateCol,
    total: totalCol,
    currency,
  };
}

function calculateHeaderConfidence(header: string[]): number {
  const lower = header.map((h) => h.toLowerCase());
  const allSynonyms = Object.values(HEADER_SYNONYMS);
  let hits = 0;
  for (const synonymSet of allSynonyms) {
    if (lower.some((h) => synonymSet.some((s) => h.includes(s)))) hits++;
  }
  return hits / allSynonyms.length;
}

export function parseSheetResilient(
  sheetName: string,
  sheet: XLSX.WorkSheet,
): SheetParseResult {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const mergedRegions = extractMergedRegions(sheet);
  const detectedHeaders: DetectedHeader[] = [];
  const rows: NormalizedRow[] = [];

  for (let r = 0; r < rawRows.length; r++) {
    const raw = rawRows[r] ?? [];
    const cells = raw.map(cellText);
    const numbers = raw
      .map((c) => parseNumber(c))
      .filter((n): n is number => n !== undefined);
    const isEmpty = cells.every((c) => !c);
    const isLikelyHeaderFlag = isHeaderRow(cells);
    const isMergedHeadingFlag = isMergedHeading(raw, cells, mergedRegions, r);

    if (isLikelyHeaderFlag) {
      const columns = mapColumns(cells, rawRows);
      const confidence = calculateHeaderConfidence(cells);
      detectedHeaders.push({ rowIndex: r, columns, confidence });
    }

    rows.push({
      cells,
      numbers,
      rowIndex: r,
      isEmpty,
      isLikelyHeader: isLikelyHeaderFlag,
      isMergedHeading: isMergedHeadingFlag,
      raw,
    });
  }

  return { name: sheetName, rows, detectedHeaders, mergedRegions, rawRows };
}

export function parseWorkbookResilient(buffer: ArrayBuffer): SheetParseResult[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return parseSheetResilient(name, sheet);
  });
}

export interface ParseDiagnostic {
  type: "info" | "warning" | "error";
  message: string;
  sheet?: string;
  row?: number;
}

export function generateParseDiagnostics(
  sheets: SheetParseResult[],
): ParseDiagnostic[] {
  const diags: ParseDiagnostic[] = [];

  for (const sheet of sheets) {
    if (sheet.detectedHeaders.length === 0) {
      diags.push({
        type: "warning",
        message: `No header row detected — using first text row as labels`,
        sheet: sheet.name,
      });
    }

    if (sheet.detectedHeaders.length > 1) {
      diags.push({
        type: "info",
        message: `Multiple header rows found (rows ${sheet.detectedHeaders.map((h) => h.rowIndex + 1).join(", ")}) — using best match`,
        sheet: sheet.name,
      });
    }

    const bestHeader = sheet.detectedHeaders.sort(
      (a, b) => b.confidence - a.confidence,
    )[0];

    if (bestHeader) {
      if (bestHeader.columns.unitRate < 0 && bestHeader.columns.total < 0) {
        diags.push({
          type: "warning",
          message: `No rate or total column detected — prices will be inferred from numeric cells`,
          sheet: sheet.name,
          row: bestHeader.rowIndex + 1,
        });
      }

      if (bestHeader.columns.area < 0) {
        diags.push({
          type: "info",
          message: `No area column — will use zone-level areas or estimated (Paint Consultants formula)`,
          sheet: sheet.name,
        });
      }
    }

    if (sheet.mergedRegions.length > 5) {
      diags.push({
        type: "info",
        message: `${sheet.mergedRegions.length} merged cell regions detected — expanded for parsing`,
        sheet: sheet.name,
      });
    }
  }

  return diags;
}

export { detectCurrency, detectUnit, HEADER_SYNONYMS };
