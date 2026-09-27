/**
 * Match Class Status Report machinery lines to vessel register assets and
 * update DB only when Class last-done / completion is newer than the app.
 * Running hours stay ship-owned (never overwritten from Class).
 */

import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { nextMachineryIdentificationNumber } from "@/lib/db/vesselMachineryAssets";
import {
  normalizeMachineryNameKey,
  parseFlexibleDate,
  type ClassMachinerySyncAction,
  type ClassMachinerySyncMatchBy,
  type ClassMachinerySyncRow,
  type ClassStatusAnalysis,
  type ClassStatusMachineryItem,
} from "@/lib/superintendent/classStatusAnalysis";

type DbAsset = {
  id: string;
  name: string;
  classItemCode: string | null;
  lastOverhaulDate: Date | null;
  nextDueDate: Date | null;
};

function isoDay(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function dayMs(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T12:00:00Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

function classLooksCompleted(status: string | null): boolean {
  if (!status) return false;
  return /\bcomplet|\bdone\b|\bclosed\b/i.test(status);
}

function syncMessage(action: ClassMachinerySyncAction): string {
  switch (action) {
    case "updated_from_class":
      return "Updated from Class (newer)";
    case "kept_app_record":
      return "Kept app record";
    case "new_from_class":
      return "New from Class";
    case "matched_no_change":
      return "Matched — no change";
  }
}

function decideAction(input: {
  matched: boolean;
  classLastDone: string | null;
  classDueDate: string | null;
  classStatus: string | null;
  appLastDone: string | null;
  appDueDate: string | null;
}): { action: ClassMachinerySyncAction; shouldUpdate: boolean } {
  if (!input.matched) {
    return { action: "new_from_class", shouldUpdate: false };
  }

  const classDoneMs = dayMs(input.classLastDone);
  const appDoneMs = dayMs(input.appLastDone);
  const classDueMs = dayMs(input.classDueDate);
  const appDueMs = dayMs(input.appDueDate);
  const classDone = classLooksCompleted(input.classStatus);

  // Class has a later last-done (or reports done when app has none) → Class wins.
  if (classDoneMs != null && (appDoneMs == null || classDoneMs > appDoneMs)) {
    return { action: "updated_from_class", shouldUpdate: true };
  }
  if (classDone && classDoneMs == null && appDoneMs == null && input.classDueDate) {
    // Completed on Class without a date — only fill empty due if app empty.
    if (appDueMs == null && classDueMs != null) {
      return { action: "updated_from_class", shouldUpdate: true };
    }
  }

  // App has later or equal last-done → keep app (may still fill empty class code link only).
  if (appDoneMs != null && (classDoneMs == null || appDoneMs >= classDoneMs)) {
    const sameDue =
      (appDueMs == null && classDueMs == null) ||
      (appDueMs != null && classDueMs != null && appDueMs === classDueMs);
    const sameDone =
      classDoneMs != null && appDoneMs != null && classDoneMs === appDoneMs;
    if (sameDone && sameDue) {
      return { action: "matched_no_change", shouldUpdate: false };
    }
    return { action: "kept_app_record", shouldUpdate: false };
  }

  // No last-done on either side: fill empty due from Class; otherwise no change / keep.
  if (classDoneMs == null && appDoneMs == null) {
    if (classDueMs != null && appDueMs == null) {
      return { action: "updated_from_class", shouldUpdate: true };
    }
    if (classDueMs != null && appDueMs != null && classDueMs === appDueMs) {
      return { action: "matched_no_change", shouldUpdate: false };
    }
    if (classDueMs != null && appDueMs != null && classDueMs !== appDueMs) {
      // Due dates differ without last-done evidence — prefer app (ship ops).
      return { action: "kept_app_record", shouldUpdate: false };
    }
    return { action: "matched_no_change", shouldUpdate: false };
  }

  return { action: "kept_app_record", shouldUpdate: false };
}

function matchAsset(
  item: ClassStatusMachineryItem,
  assets: DbAsset[],
  usedIds: Set<string>,
): { asset: DbAsset | null; matchBy: ClassMachinerySyncMatchBy } {
  if (item.machineryAssetId) {
    const byId = assets.find((a) => a.id === item.machineryAssetId && !usedIds.has(a.id));
    if (byId) return { asset: byId, matchBy: "asset_id" };
  }
  if (item.classCode) {
    const code = item.classCode.toUpperCase();
    const byCode = assets.find(
      (a) => a.classItemCode?.toUpperCase() === code && !usedIds.has(a.id),
    );
    if (byCode) return { asset: byCode, matchBy: "class_code" };
  }
  const nameKey = normalizeMachineryNameKey(item.name);
  if (nameKey) {
    const byName = assets.find(
      (a) => normalizeMachineryNameKey(a.name) === nameKey && !usedIds.has(a.id),
    );
    if (byName) return { asset: byName, matchBy: "name" };
  }
  return { asset: null, matchBy: null };
}

export async function syncClassMachineryToVesselRegister(input: {
  vesselId: string;
  analysis: ClassStatusAnalysis;
  /** When true, persist Class-newer updates and create new assets. Default true. */
  apply?: boolean;
}): Promise<{
  analysis: ClassStatusAnalysis;
  sync: ClassMachinerySyncRow[];
}> {
  const apply = input.apply !== false;
  const assets = (await prisma.vesselMachineryAsset.findMany({
    where: { vesselId: input.vesselId, ...notDeleted },
    select: {
      id: true,
      name: true,
      classItemCode: true,
      lastOverhaulDate: true,
      nextDueDate: true,
    },
  })) as DbAsset[];

  const usedIds = new Set<string>();
  const sync: ClassMachinerySyncRow[] = [];
  const nextMachinery: ClassStatusMachineryItem[] = [];

  for (let i = 0; i < input.analysis.machinery.length; i++) {
    const item = input.analysis.machinery[i]!;
    const { asset, matchBy } = matchAsset(item, assets, usedIds);
    if (asset) usedIds.add(asset.id);

    const classLastDone = parseFlexibleDate(item.lastDone);
    const classDueDate = parseFlexibleDate(item.dueDate);
    const appLastDone = isoDay(asset?.lastOverhaulDate ?? null);
    const appDueDate = isoDay(asset?.nextDueDate ?? null);

    const { action, shouldUpdate } = decideAction({
      matched: Boolean(asset),
      classLastDone,
      classDueDate,
      classStatus: item.status,
      appLastDone,
      appDueDate,
    });

    let machineryAssetId = asset?.id ?? null;
    let applied = false;
    let finalAction = action;

    if (apply && asset && shouldUpdate) {
      await prisma.vesselMachineryAsset.update({
        where: { id: asset.id },
        data: {
          ...(classLastDone
            ? { lastOverhaulDate: new Date(`${classLastDone}T12:00:00Z`) }
            : {}),
          ...(classDueDate ? { nextDueDate: new Date(`${classDueDate}T12:00:00Z`) } : {}),
          ...(item.classCode && !asset.classItemCode
            ? { classItemCode: item.classCode }
            : {}),
          // Never touch currentRunningHours / nextDueHours — ship-owned.
        },
      });
      applied = true;
      asset.lastOverhaulDate = classLastDone
        ? new Date(`${classLastDone}T12:00:00Z`)
        : asset.lastOverhaulDate;
      asset.nextDueDate = classDueDate
        ? new Date(`${classDueDate}T12:00:00Z`)
        : asset.nextDueDate;
      if (item.classCode && !asset.classItemCode) asset.classItemCode = item.classCode;
    } else if (apply && asset && item.classCode && !asset.classItemCode) {
      // Persist Class code link without overwriting dates (idempotent identity).
      await prisma.vesselMachineryAsset.update({
        where: { id: asset.id },
        data: { classItemCode: item.classCode },
      });
      asset.classItemCode = item.classCode;
      applied = true;
    }

    if (apply && !asset && action === "new_from_class") {
      try {
        const identificationNumber = await nextMachineryIdentificationNumber(input.vesselId);
        const created = await prisma.vesselMachineryAsset.create({
          data: {
            vesselId: input.vesselId,
            identificationNumber,
            classItemCode: item.classCode,
            name: item.name.trim(),
            department: "Machinery",
            isActive: true,
            lastOverhaulDate: classLastDone
              ? new Date(`${classLastDone}T12:00:00Z`)
              : null,
            nextDueDate: classDueDate ? new Date(`${classDueDate}T12:00:00Z`) : null,
            notes: item.reason
              ? `From Class Status Report. ${item.reason}`
              : "From Class Status Report.",
          },
        });
        machineryAssetId = created.id;
        applied = true;
        assets.push({
          id: created.id,
          name: created.name,
          classItemCode: created.classItemCode,
          lastOverhaulDate: created.lastOverhaulDate,
          nextDueDate: created.nextDueDate,
        });
        usedIds.add(created.id);
        finalAction = "new_from_class";
      } catch {
        // Unique race on classItemCode / identification — rematch existing, no duplicate.
        let rematched = matchAsset(item, assets, usedIds).asset;
        if (!rematched && item.classCode) {
          rematched = await prisma.vesselMachineryAsset.findFirst({
            where: {
              vesselId: input.vesselId,
              classItemCode: item.classCode,
              ...notDeleted,
            },
            select: {
              id: true,
              name: true,
              classItemCode: true,
              lastOverhaulDate: true,
              nextDueDate: true,
            },
          });
        }
        if (rematched) {
          machineryAssetId = rematched.id;
          usedIds.add(rematched.id);
          finalAction = "matched_no_change";
          applied = false;
        }
      }
    }

    const row: ClassMachinerySyncRow = {
      id: `sync-${i + 1}-${item.id}`,
      classMachineryId: item.id,
      machineryAssetId,
      name: item.name,
      classCode: item.classCode,
      matchBy,
      action: finalAction,
      message: syncMessage(finalAction),
      classLastDone,
      classDueDate,
      classStatus: item.status,
      appLastDone,
      appDueDate,
      applied,
    };
    sync.push(row);

    nextMachinery.push({
      ...item,
      machineryAssetId,
      lastDone:
        finalAction === "kept_app_record" && appLastDone
          ? appLastDone
          : item.lastDone,
      dueDate:
        finalAction === "kept_app_record" && appDueDate ? appDueDate : item.dueDate,
    });
  }

  const analysis: ClassStatusAnalysis = {
    ...input.analysis,
    machinery: nextMachinery,
    machinerySync: sync,
  };

  return { analysis, sync };
}
