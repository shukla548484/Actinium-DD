import * as XLSX from "xlsx";
import type { LineItem, VendorQuote } from "@/lib/types";

const HEADER_KEYWORDS = [
  "service",
  "description",
  "item",
  "scope",
  "work",
  "activity",
  "particular",
  "details",
  "qty",
  "quantity",
  "unit",
  "rate",
  "price",
  "amount",
  "total",
  "cost",
];

const PRICE_HEADER_KEYWORDS = ["price", "rate", "amount", "total", "cost", "value"];

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const text = cellText(value).replace(/[,$\s]/g, "");
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function rowToStrings(row: unknown[]): string[] {
  return row.map((c) => cellText(c));
}

function isLikelyHeading(row: string[], numbers: number[]): boolean {
  const text = row.filter(Boolean).join(" ").trim();
  if (!text || numbers.length > 0) return false;
  if (text.length < 80 && /^[A-Z0-9\s\-/&]+$/.test(text)) return true;
  if (row.filter(Boolean).length <= 2 && text.length < 60) return true;
  return false;
}

function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const line = rowToStrings(rows[i] ?? []).join(" ").toLowerCase();
    const hits = HEADER_KEYWORDS.filter((k) => line.includes(k)).length;
    if (hits >= 2) return i;
  }
  return -1;
}

function mapColumns(header: string[]): {
  serviceCol: number;
  qtyCol: number;
  unitCol: number;
  totalCol: number;
  descCol: number;
} {
  const lower = header.map((h) => h.toLowerCase());
  const find = (keys: string[]) =>
    lower.findIndex((h) => keys.some((k) => h.includes(k)));

  const serviceCol = find([
    "service",
    "description",
    "item",
    "scope",
    "work",
    "activity",
    "particular",
    "details",
  ]);
  const qtyCol = find(["qty", "quantity", "units"]);
  const unitCol = find(["unit price", "unit rate", "rate", "unit"]);
  const totalCol = find(["total", "amount", "extended", "line total", "value"]);
  const descCol = serviceCol;

  return {
    serviceCol: serviceCol >= 0 ? serviceCol : 0,
    qtyCol,
    unitCol,
    totalCol,
    descCol,
  };
}

function extractFromSheet(
  sheetName: string,
  rows: unknown[][],
  vendorName: string,
): LineItem[] {
  const items: LineItem[] = [];
  const headerIdx = detectHeaderRow(rows);
  let serviceCol = 0;
  let qtyCol = -1;
  let unitCol = -1;
  let totalCol = -1;
  let startRow = 0;
  let category = "";

  if (headerIdx >= 0) {
    const header = rowToStrings(rows[headerIdx] ?? []);
    const cols = mapColumns(header);
    serviceCol = cols.serviceCol;
    qtyCol = cols.qtyCol;
    unitCol = cols.unitCol;
    totalCol = cols.totalCol;
    startRow = headerIdx + 1;

    if (unitCol === totalCol && unitCol >= 0) {
      const priceHeaders = header.map((h) => h.toLowerCase());
      const unitIdx = priceHeaders.findIndex(
        (h) => h.includes("unit") || h === "rate" || h.includes("unit price"),
      );
      const totalIdx = priceHeaders.findIndex(
        (h) => h.includes("total") || h.includes("amount") || h.includes("extended"),
      );
      unitCol = unitIdx >= 0 ? unitIdx : unitCol;
      totalCol = totalIdx >= 0 ? totalIdx : totalCol;
    }
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const strings = rowToStrings(row);
    const numbers = row
      .map((c) => parseNumber(c))
      .filter((n): n is number => n !== undefined);

    if (strings.every((s) => !s)) continue;

    if (isLikelyHeading(strings, numbers)) {
      category = strings.filter(Boolean).join(" — ") || category;
      continue;
    }

    const serviceName =
      strings[serviceCol] ||
      strings.find((s) => s.length > 2) ||
      "";

    if (!serviceName || serviceName.length < 2) continue;

    const lowerName = serviceName.toLowerCase();
    if (
      ["subtotal", "grand total", "total", "tax", "gst", "vat", "summary"].some(
        (t) => lowerName === t || lowerName.startsWith(`${t} `),
      )
    ) {
      continue;
    }

    const qty = qtyCol >= 0 ? parseNumber(row[qtyCol]) : undefined;
    let unitPrice = unitCol >= 0 ? parseNumber(row[unitCol]) : undefined;
    let totalPrice = totalCol >= 0 ? parseNumber(row[totalCol]) : undefined;

    if (unitPrice === undefined && totalPrice === undefined && numbers.length > 0) {
      const priceLike = numbers.filter((n) => n > 0);
      if (priceLike.length === 1) {
        totalPrice = priceLike[0];
      } else if (priceLike.length >= 2) {
        unitPrice = priceLike[priceLike.length - 2];
        totalPrice = priceLike[priceLike.length - 1];
      }
    }

    if (unitPrice === undefined && totalPrice === undefined) continue;

    const description =
      strings
        .filter((_, i) => i !== serviceCol && strings[i])
        .join(" ")
        .slice(0, 200) || undefined;

    items.push({
      serviceName,
      category: category || undefined,
      description,
      quantity: qty,
      unitPrice,
      totalPrice,
      sheetName,
      rowIndex: r + 1,
    });
  }

  return items;
}

export async function parseExcelFile(
  file: File,
  vendorName?: string,
): Promise<VendorQuote> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = vendorName?.trim() || file.name.replace(/\.[^.]+$/, "");

  const allItems: LineItem[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    allItems.push(...extractFromSheet(sheetName, rows, name));
  }

  return {
    vendorName: name,
    fileName: file.name,
    items: allItems,
  };
}

export function parseExcelFiles(
  files: File[],
  vendorNames: string[],
): Promise<VendorQuote[]> {
  return Promise.all(
    files.map((file, i) =>
      parseExcelFile(file, vendorNames[i] || undefined),
    ),
  );
}
