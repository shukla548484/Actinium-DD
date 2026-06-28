import * as XLSX from "xlsx";
import { buildDryDockComparison } from "@/lib/dryDock/buildDryDockComparison";
import { parseDryDockFromRows } from "@/lib/dryDock/parseDryDock";
import type { DryDockComparison, VendorDryDockQuote } from "@/lib/dryDock/types";

export type { DryDockComparison, VendorDryDockQuote } from "@/lib/dryDock/types";
export { downloadDryDockComparisonExcel } from "@/lib/dryDock/exportDryDockComparison";

export async function parseDryDockFile(
  file: File,
  vendorName?: string,
): Promise<VendorDryDockQuote> {
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

  return parseDryDockFromRows(name, file.name, sheets);
}

export function compareDryDockQuotes(quotes: VendorDryDockQuote[]): DryDockComparison {
  return buildDryDockComparison(quotes);
}
