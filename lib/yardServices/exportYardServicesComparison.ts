import * as XLSX from "xlsx";
import type { YardServicesComparison } from "@/lib/yardServices/types";

function fmt(n: number | null | undefined): string | number {
  if (n == null || Number.isNaN(n)) return "";
  return n;
}

export function yardServicesComparisonToWorkbook(
  result: YardServicesComparison,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const durationHeader = [
    "Vendor",
    "Shipyard days",
    "Dry-dock days",
    "CPR days",
    "Total service days",
    "Connection days",
  ];
  const durationRows = [
    durationHeader,
    ...result.vendors.map((v) => {
      const d = result.durationByVendor[v];
      return [
        v,
        fmt(d?.shipyardDays ?? null),
        fmt(d?.dryDockDays ?? null),
        fmt(d?.cprDays ?? null),
        fmt(d?.totalServiceDays ?? null),
        fmt(d?.connectionDays ?? null),
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(durationRows),
    "Duration",
  );

  const detailHeader = [
    "Service",
    "Type",
    "Vendor",
    "Rate",
    "Units / persons / connections",
    "Min units",
    "Connect/disconnect rate",
    "Hookup multiplier",
    "Connect/disconnect subtotal",
    "Daily cost",
    "Service days",
    "Calculated total",
    "Quoted total",
    "Original label",
  ];

  const detailRows: (string | number)[][] = [detailHeader];

  for (const row of result.rows) {
    for (const vendor of result.vendors) {
      const cell = row.byVendor[vendor];
      if (!cell?.calculatedTotal && !cell?.quotedTotal && !cell?.rate) continue;

      detailRows.push([
        row.serviceName,
        row.kind,
        vendor,
        fmt(cell.rate),
        row.kind === "equipment" || row.kind === "connection"
          ? fmt(cell.effectiveUnits ?? null)
          : fmt(cell.personsPerDay ?? null),
        row.kind === "equipment" ? fmt(cell.minimumUnits ?? null) : "",
        row.kind === "connection" ? fmt(cell.rateConnectDisconnect ?? null) : "",
        row.kind === "connection"
          ? fmt(cell.connectDisconnectMultiplier ?? row.connectDisconnectMultiplier ?? null)
          : "",
        row.kind === "connection" ? fmt(cell.connectDisconnectTotal ?? null) : "",
        fmt(cell.dailyCost),
        fmt(cell.serviceDays),
        fmt(cell.calculatedTotal),
        fmt(cell.quotedTotal),
        cell.originalLabel ?? "",
      ]);
    }
  }

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(detailRows),
    "Services",
  );

  const totalsHeader = [
    "Vendor",
    "Watch services total",
    "Temporary equipment total",
    "Utility connections total",
    "Grand total",
  ];
  const totalsRows = [
    totalsHeader,
    ...result.vendors.map((v) => {
      const t = result.totalsByVendor[v];
      return [
        v,
        fmt(t?.watchGrandTotal ?? null),
        fmt(t?.equipmentGrandTotal ?? null),
        fmt(t?.connectionGrandTotal ?? null),
        fmt(t?.grandTotal ?? null),
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(totalsRows),
    "Totals",
  );

  return wb;
}

export function downloadYardServicesComparisonExcel(
  result: YardServicesComparison,
  filename = "yard-services-comparison.xlsx",
): void {
  XLSX.writeFile(yardServicesComparisonToWorkbook(result), filename);
}
