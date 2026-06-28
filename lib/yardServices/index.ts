import * as XLSX from "xlsx";
import { buildYardServicesComparison } from "@/lib/yardServices/buildYardServicesComparison";
import { parseYardServicesFromRows } from "@/lib/yardServices/parseYardServices";
import type {
  VendorYardServicesQuote,
  YardServicesComparison,
} from "@/lib/yardServices/types";

export type {
  VendorYardServicesQuote,
  YardServicesComparison,
} from "@/lib/yardServices/types";
export { downloadYardServicesComparisonExcel } from "@/lib/yardServices/exportYardServicesComparison";

async function readWorkbookSheets(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    return { name: sheetName, rows };
  });
  return sheets;
}

export async function parseYardServicesFile(
  file: File,
  vendorName?: string,
): Promise<VendorYardServicesQuote> {
  const sheets = await readWorkbookSheets(file);
  const name = vendorName?.trim() || file.name.replace(/\.[^.]+$/, "");
  return parseYardServicesFromRows(name, file.name, sheets);
}

export function compareYardServicesQuotes(
  quotes: VendorYardServicesQuote[],
): YardServicesComparison {
  return buildYardServicesComparison(quotes);
}

export async function parseAndCompareYardServices(
  files: File[],
  vendorNames: string[],
): Promise<{ quotes: VendorYardServicesQuote[]; comparison: YardServicesComparison }> {
  const quotes = await Promise.all(
    files.map((file, i) => parseYardServicesFile(file, vendorNames[i])),
  );
  return { quotes, comparison: compareYardServicesQuotes(quotes) };
}
