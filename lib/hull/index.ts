import * as XLSX from "xlsx";
import {
  buildHullPaintComparison,
  fuzzyMergeHullItems,
} from "@/lib/hull/buildHullComparison";
import { parseHullPaintFromRows } from "@/lib/hull/parseHullPaint";
import { extractVesselParticularsFromRows } from "@/lib/hull/extractVesselParticulars";
import type { HullPaintComparison, VendorHullPaintQuote } from "@/lib/hull/types";

export async function parseHullPaintFile(
  file: File,
  vendorName?: string,
): Promise<VendorHullPaintQuote> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const name = vendorName?.trim() || file.name.replace(/\.[^.]+$/, "");

  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    return { name: sheetName, rows };
  });

  const quote = parseHullPaintFromRows(name, file.name, sheets);
  quote.lineItems = fuzzyMergeHullItems(quote.lineItems);
  quote.vesselParticulars = extractVesselParticularsFromRows(sheets);
  return quote;
}

export function compareHullPaintQuotes(
  quotes: VendorHullPaintQuote[],
): HullPaintComparison {
  return buildHullPaintComparison(quotes);
}

export async function parseAndCompareHullPaint(
  files: File[],
  vendorNames: string[],
): Promise<{ quotes: VendorHullPaintQuote[]; comparison: HullPaintComparison }> {
  const quotes = await Promise.all(
    files.map((file, i) => parseHullPaintFile(file, vendorNames[i])),
  );
  return { quotes, comparison: compareHullPaintQuotes(quotes) };
}
