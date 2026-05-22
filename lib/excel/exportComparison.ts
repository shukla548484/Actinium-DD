import * as XLSX from "xlsx";
import type { ComparisonResult } from "@/lib/types";

function formatMoney(n: number | undefined): string | number {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n * 100) / 100;
}

export function comparisonToWorkbook(result: ComparisonResult): XLSX.WorkBook {
  const { vendors, rows } = result;
  const header = [
    "Standard Service",
    "Category",
    ...vendors.flatMap((v) => [
      `${v} — Original Label`,
      `${v} — Qty`,
      `${v} — Unit Price`,
      `${v} — Total`,
      `${v} — Match %`,
    ]),
  ];

  const data: (string | number)[][] = [header];

  for (const row of rows) {
    const line: (string | number)[] = [
      row.service.name,
      row.service.category ?? "",
    ];
    for (const vendor of vendors) {
      const cell = row.byVendor[vendor];
      const item = cell?.item;
      const match = cell?.match;
      line.push(
        item?.serviceName ?? "",
        item?.quantity ?? "",
        formatMoney(item?.unitPrice),
        formatMoney(item?.totalPrice),
        match ? Math.round(match.score * 100) : "",
      );
    }
    data.push(line);
  }

  const sheet = XLSX.utils.aoa_to_sheet(data);
  const colWidths = header.map((h, i) => ({
    wch: i < 2 ? 28 : Math.min(22, h.length + 2),
  }));
  sheet["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Vendor Comparison");
  return wb;
}

export function downloadComparisonExcel(
  result: ComparisonResult,
  filename = "vendor-quote-comparison.xlsx",
): void {
  const wb = comparisonToWorkbook(result);
  XLSX.writeFile(wb, filename);
}
