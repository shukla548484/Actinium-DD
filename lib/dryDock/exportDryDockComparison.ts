import * as XLSX from "xlsx";
import type { DryDockComparison } from "@/lib/dryDock/types";

function fmt(n: number | null | undefined): string | number {
  if (n == null || Number.isNaN(n)) return "";
  return Math.round(n * 100) / 100;
}

export function dryDockComparisonToWorkbook(result: DryDockComparison): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = [
    "Vendor",
    "Stated dry-dock days",
    "Days source",
    "Daily rate",
    "Rate line",
    "Calculated total (days × rate)",
    "Quoted line total",
    "Variance (quoted − calculated)",
    "Notes",
  ];
  const rows: (string | number)[][] = [header];

  for (const vendor of result.vendors) {
    const q = result.byVendor[vendor];
    const variance =
      q.calculatedTotal != null && q.quotedTotal != null
        ? Math.round((q.quotedTotal - q.calculatedTotal) * 100) / 100
        : "";
    rows.push([
      vendor,
      fmt(q.dryDockDays),
      q.daysSource ?? "",
      fmt(q.dailyRatePerDay),
      q.rateLineLabel ?? "",
      fmt(q.calculatedTotal),
      fmt(q.quotedTotal),
      variance,
      q.warnings.join(" "),
    ]);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Dry dock");
  return wb;
}

export function downloadDryDockComparisonExcel(
  result: DryDockComparison,
  filename = "dry-dock-comparison.xlsx",
): void {
  XLSX.writeFile(dryDockComparisonToWorkbook(result), filename);
}
