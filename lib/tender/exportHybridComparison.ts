import * as XLSX from "xlsx";
import { categoryLabelFromList } from "@/lib/tender/categories";
import type { HybridComparison } from "@/lib/tender/types";

export function hybridComparisonToWorkbook(result: HybridComparison): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const categories = result.project.categories ?? [];

  const durationHeader = [
    "Vendor",
    "Shipyard days",
    "Dry-dock days",
    "CPR days",
    "Source",
    "Status",
  ];
  const durationRows = [
    durationHeader,
    ...result.yards.map((y) => {
      const d = result.project;
      return [
        y.name,
        d.shipyardDays ?? "",
        d.dryDockDays ?? "",
        d.cprDays ?? "",
        y.sourceType,
        y.status,
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(durationRows), "Yards");

  const header = [
    "Bucket",
    "Code",
    "Description (EN)",
    "Description (ZH)",
    "Description (JA)",
    "Unit",
    "Scope qty",
    "Scope days",
    "Scope m²",
    ...result.yards.flatMap((y) => [
      `${y.name} — rate`,
      `${y.name} — disc %`,
      `${y.name} — gross`,
      `${y.name} — net`,
      `${y.name} — source`,
    ]),
  ];

  const allRows = [...result.rows, ...result.extraRows];
  const detailRows: (string | number)[][] = [header];

  for (const row of allRows) {
    detailRows.push([
      categoryLabelFromList(categories, row.bucket),
      row.lineCode ?? "",
      row.description,
      row.descriptions?.zh ?? "",
      row.descriptions?.ja ?? "",
      row.unit ?? "",
      row.scopeQty ?? "",
      row.scopeDays ?? "",
      row.scopeAreaM2 ?? "",
      ...result.yards.flatMap((y) => {
        const c = row.byYard[y.id];
        return [
          c?.unitRate ?? "",
          c?.discountPct ?? "",
          c?.grossTotal ?? "",
          c?.netTotal ?? c?.calculatedTotal ?? "",
          c?.source ?? "",
        ];
      }),
    ]);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Comparison");

  const totalsHeader: (string | number)[] = ["Bucket", ...result.yards.map((y) => y.name), "Lowest"];
  const totalsRows: (string | number)[][] = [totalsHeader];

  for (const b of result.bucketTotals) {
    const vals = result.yards.map((y) => b.byYard[y.id] ?? "");
    const nums = vals.filter((v): v is number => typeof v === "number");
    const lowest = nums.length ? Math.min(...nums) : "";
    totalsRows.push([b.label, ...vals, lowest]);
  }

  const grand = result.yards.map((y) => result.grandTotals[y.id] ?? "");
  const grandNums = grand.filter((v): v is number => typeof v === "number");
  totalsRows.push([
    "GRAND TOTAL",
    ...grand,
    grandNums.length ? Math.min(...grandNums) : "",
  ]);

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalsRows), "Totals");

  return wb;
}

export function downloadHybridComparisonExcel(
  result: HybridComparison,
  filename = "tender-comparison.xlsx",
): void {
  XLSX.writeFile(hybridComparisonToWorkbook(result), filename);
}
