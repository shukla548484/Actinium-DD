import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMainEngineMachinery } from "@/lib/spares-inventory/is-main-engine-machinery";
import {
  displayCatalogItemNumber,
  displayCatalogPartNumber,
  displaySparePartDwgNumber,
} from "@/lib/spares-inventory/spare-part-number-display";

export type MainEnginePlateCatalogEntry = {
  itemNumber: string;
  partNumber: string | null;
  partName: string | null;
  drawingNumber: string | null;
  source: "catalog" | "inventory" | "requisition";
};

export type MainEnginePlateCatalogLineInput = {
  plateNumber?: string | null;
  itemNumber?: string | null;
  partNumber?: string | null;
  partName?: string | null;
  drawingNumber?: string | null;
  machineryInstanceId?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normKey(value: string | null | undefined): string {
  return norm(value).toLowerCase();
}

function mergeEntry(
  map: Map<string, MainEnginePlateCatalogEntry>,
  entry: MainEnginePlateCatalogEntry
) {
  const key = normKey(entry.itemNumber);
  if (!key) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entry);
    return;
  }
  const priority = { catalog: 3, inventory: 2, requisition: 1 };
  if (priority[entry.source] >= priority[existing.source]) {
    map.set(key, {
      itemNumber: entry.itemNumber,
      partNumber: entry.partNumber ?? existing.partNumber,
      partName: entry.partName ?? existing.partName,
      drawingNumber: entry.drawingNumber ?? existing.drawingNumber,
      source: entry.source,
    });
  }
}

export async function listMainEnginePlateCatalogItems(params: {
  vesselId: string;
  machineryId: string;
  plateNumber: string;
}): Promise<MainEnginePlateCatalogEntry[]> {
  const vesselId = params.vesselId.trim();
  const machineryId = params.machineryId.trim();
  const plateNumber = norm(params.plateNumber);
  if (!vesselId || !machineryId || !plateNumber) return [];

  const map = new Map<string, MainEnginePlateCatalogEntry>();

  const catalogRows = await prisma.mainEnginePlateCatalogItem.findMany({
    where: {
      vesselId,
      machineryId,
      plateNumber: { equals: plateNumber, mode: "insensitive" },
    },
    select: {
      itemNumber: true,
      partNumber: true,
      partName: true,
      drawingNumber: true,
    },
    orderBy: { itemNumber: "asc" },
  });

  for (const row of catalogRows) {
    mergeEntry(map, {
      itemNumber: row.itemNumber,
      partNumber: row.partNumber,
      partName: row.partName,
      drawingNumber: row.drawingNumber,
      source: "catalog",
    });
  }

  const spareParts = await prisma.sparePart.findMany({
    where: {
      vesselId,
      machineryId,
      isActive: true,
      plateNumber: { equals: plateNumber, mode: "insensitive" },
    },
    select: {
      sparePartNumber: true,
      name: true,
      description: true,
    },
    orderBy: { sparePartNumber: "asc" },
  });

  for (const part of spareParts) {
    const itemNo = displayCatalogItemNumber(part.sparePartNumber);
    const partNo = displayCatalogPartNumber(part.sparePartNumber);
    const resolvedItemNumber =
      itemNo !== "—"
        ? itemNo
        : partNo !== "—"
          ? null
          : norm(part.sparePartNumber) || null;
    if (!resolvedItemNumber) continue;

    mergeEntry(map, {
      itemNumber: resolvedItemNumber,
      partNumber: partNo !== "—" ? partNo : norm(part.sparePartNumber) || null,
      partName: norm(part.name) || null,
      drawingNumber:
        displaySparePartDwgNumber(part.description) !== "—"
          ? displaySparePartDwgNumber(part.description)
          : null,
      source: "inventory",
    });
  }

  const pastItems = await prisma.$queryRaw<
    Array<{
      item_number: string;
      part_number: string | null;
      part_name: string | null;
      drawing_number: string | null;
    }>
  >`
    SELECT DISTINCT ON (lower(trim(ri.item_number)))
      ri.item_number,
      ri.part_number,
      ri.part_name,
      ri.drawing_number
    FROM requisition_items ri
    INNER JOIN requisitions r ON r.id = ri.requisition_id
    LEFT JOIN machinery_instances mi ON mi.id = ri.machinery_instance_id
    WHERE r.vessel_id = ${vesselId}::uuid
      AND r.requisition_type = 'SPR'
      AND lower(trim(ri.plate_number)) = lower(trim(${plateNumber}))
      AND NULLIF(trim(ri.item_number), '') IS NOT NULL
      AND (
        ri.machinery_instance_id = ${machineryId}::uuid
        OR mi.machinery_id = ${machineryId}::uuid
      )
    ORDER BY lower(trim(ri.item_number)), ri.updated_at DESC
  `.catch(() => []);

  for (const row of pastItems) {
    const itemNumber = norm(row.item_number);
    if (!itemNumber) continue;
    mergeEntry(map, {
      itemNumber,
      partNumber: norm(row.part_number) || null,
      partName: norm(row.part_name) || null,
      drawingNumber: norm(row.drawing_number) || null,
      source: "requisition",
    });
  }

  return [...map.values()].sort((a, b) =>
    a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true })
  );
}

export async function upsertMainEnginePlateCatalogFromRequisitionItems(
  db: Prisma.TransactionClient | typeof prisma,
  params: {
    vesselId: string;
    items: MainEnginePlateCatalogLineInput[];
  }
): Promise<void> {
  const { resolveMachineryIdForRequisitionSpareItem } = await import(
    "@/lib/spares-inventory/resolve-machinery-id-for-requisition-item"
  );

  const vesselId = params.vesselId.trim();
  if (!vesselId) return;

  const machineryCache = new Map<string, boolean>();

  for (const item of params.items) {
    const plateNumber = norm(item.plateNumber);
    const itemNumber = norm(item.itemNumber);
    if (!plateNumber || !itemNumber) continue;

    const machineryId = await resolveMachineryIdForRequisitionSpareItem(
      db,
      item.machineryInstanceId
    );
    if (!machineryId) continue;

    let isMainEngine = machineryCache.get(machineryId);
    if (isMainEngine === undefined) {
      const machinery = await db.machinery.findUnique({
        where: { id: machineryId },
        select: { name: true, machineryType: true, model: true, vesselId: true },
      });
      if (!machinery || machinery.vesselId !== vesselId) continue;
      isMainEngine = isMainEngineMachinery(machinery);
      machineryCache.set(machineryId, isMainEngine);
    }
    if (!isMainEngine) continue;

    const existing = await db.mainEnginePlateCatalogItem.findFirst({
      where: {
        vesselId,
        machineryId,
        plateNumber: { equals: plateNumber, mode: "insensitive" },
        itemNumber: { equals: itemNumber, mode: "insensitive" },
      },
      select: { id: true },
    });

    const data = {
      partNumber: norm(item.partNumber) || null,
      partName: norm(item.partName) || null,
      drawingNumber: norm(item.drawingNumber) || null,
    };

    if (existing) {
      await db.mainEnginePlateCatalogItem.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await db.mainEnginePlateCatalogItem.create({
        data: {
          vesselId,
          machineryId,
          plateNumber,
          itemNumber,
          ...data,
        },
      });
    }
  }
}
