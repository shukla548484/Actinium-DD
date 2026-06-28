import * as XLSX from "xlsx";
import type { HullPaintComparison } from "@/lib/hull/types";

function fmt(n: number | null | undefined): string | number {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n * 100) / 100;
}

export function hullComparisonToWorkbook(result: HullPaintComparison): XLSX.WorkBook {
  const { vendors, rows, zoneSummaries } = result;
  const wb = XLSX.utils.book_new();

  const areaHeader = [
    "Hull zone",
    ...vendors.flatMap((v) => [`${v} — Area (m²)`, `${v} — Source note`]),
  ];
  const areaRows: (string | number)[][] = [areaHeader];
  for (const z of zoneSummaries) {
    areaRows.push([
      z.zoneName,
      ...vendors.flatMap((v) => [fmt(z.areaByVendor[v]), ""]),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaRows), "Hull Areas");

  const prepHeader = [
    "Hull zone",
    "Treatment / service",
    ...vendors.flatMap((v) => [
      `${v} — Area (m²)`,
      `${v} — Rate/m²`,
      `${v} — Calc total`,
      `${v} — Quoted total`,
      `${v} — As quoted`,
    ]),
  ];
  const prepRows: (string | number)[][] = [prepHeader];
  for (const row of rows) {
    prepRows.push([
      row.zoneName,
      row.serviceName,
      ...vendors.flatMap((v) => {
        const cell = row.byVendor[v];
        return [
          fmt(row.areaByVendor[v]),
          fmt(cell?.unitRatePerSqm),
          fmt(cell?.calculatedTotal),
          fmt(cell?.quotedTotal),
          cell?.originalLabel ?? "",
        ];
      }),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prepRows), "Prep by zone");

  return wb;
}

export function downloadHullComparisonExcel(
  result: HullPaintComparison,
  filename = "hull-paint-comparison.xlsx",
): void {
  XLSX.writeFile(hullComparisonToWorkbook(result), filename);
}
