import * as XLSX from "xlsx";
import { parseDryDockFromRows } from "@/lib/dryDock/parseDryDock";
import { parseExcelBuffer } from "@/lib/excel/parseQuote";
import { parseHullPaintFromRows } from "@/lib/hull/parseHullPaint";
import { parseYardServicesFromRows } from "@/lib/yardServices/parseYardServices";
import { saveVendorCompareSnapshot } from "@/lib/db/fleetSnapshot";
import type { SyncOriginNode } from "@/lib/sync/constants";

function sheetsFromBuffer(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    return { name: sheetName, rows };
  });
}

/** Parse hull/dry-dock/yard modules from Excel buffer and store compare_snapshots. */
export async function saveExcelCompareSnapshotsFromBuffer(input: {
  projectId: string;
  inviteId?: string | null;
  fileName: string;
  vendorName: string;
  buffer: ArrayBuffer;
  originNode: SyncOriginNode;
}): Promise<void> {
  const sheets = sheetsFromBuffer(input.buffer);
  const vendor = input.vendorName.trim() || input.fileName.replace(/\.[^.]+$/, "");

  const general = parseExcelBuffer(input.buffer, vendor, input.fileName);
  const hull = parseHullPaintFromRows(vendor, input.fileName, sheets);
  const dryDock = parseDryDockFromRows(vendor, input.fileName, sheets);
  const yard = parseYardServicesFromRows(vendor, input.fileName, sheets);

  await saveVendorCompareSnapshot({
    projectId: input.projectId,
    inviteId: input.inviteId,
    vendorName: vendor,
    fileName: input.fileName,
    originNode: input.originNode,
    snapshot: {
      general: { lineItemCount: general.items.length },
      hull: {
        zoneAreas: hull.zoneAreas,
        lineItems: hull.lineItems,
        vesselParticulars: hull.vesselParticulars,
      },
      dryDock: dryDock,
      yardServices: yard,
    },
  });
}
