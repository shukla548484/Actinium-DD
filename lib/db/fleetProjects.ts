import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { seedStandardCategories } from "@/lib/db/categories";
import { buildDefaultSpecLines } from "@/lib/tender/defaultSpec";
import { prisma } from "@/lib/prisma";
import { mapProject } from "@/lib/db/mappers";
import { loadProjectSnapshot, saveProjectSnapshot } from "@/lib/db/fleetSnapshot";
import type { CompareAppSnapshot } from "@/lib/desktop/snapshot";
import { EMPTY_COMPARE_SNAPSHOT } from "@/lib/desktop/snapshot";
import type { SyncOriginNode } from "@/lib/sync/constants";
import { fleetOriginFromEnv } from "@/lib/sync/touch";
import { toPrismaScopeLocale } from "@/lib/db/mappers";
import type { Project } from "@/lib/tender/types";
import { recordSyncTombstone } from "@/lib/sync/tombstone";

const notDeleted = { deletedAt: null };

export async function listFleetProjects(vesselId?: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: {
      ...notDeleted,
      ...(vesselId ? { vesselId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapProject);
}

export async function createFleetProject(input: {
  name: string;
  vesselName?: string;
  vesselId?: string;
  originNode?: SyncOriginNode;
}): Promise<Project> {
  const originNode = input.originNode ?? fleetOriginFromEnv();
  const specTemplate = buildDefaultSpecLines("pending");

  const project = await prisma.project.create({
    data: {
      name: input.name.trim(),
      vesselName: input.vesselName?.trim() ?? null,
      vesselId: input.vesselId?.trim() ?? process.env.VESSEL_ID?.trim() ?? null,
      originNode,
      officeChangedAt: new Date(),
      specLines: {
        create: specTemplate.map((line) => ({
          bucket: line.bucket,
          sortOrder: line.sortOrder,
          lineCode: line.lineCode,
          descriptionEn: line.descriptions.en,
          descriptionZh: line.descriptions.zh,
          descriptionJa: line.descriptions.ja,
          unit: line.unit,
          defaultQty: line.defaultQty,
          scopeDays: line.scopeDays ?? null,
          scopeAreaM2: line.scopeAreaM2 ?? null,
          scopeNotes: line.scopeNotes ?? null,
          ownerLocked: line.ownerLocked ?? true,
          allowDiscount: line.allowDiscount ?? true,
          maxDiscountPct: line.maxDiscountPct ?? null,
          referenceUnitRate: line.referenceUnitRate ?? null,
          calcRule: line.calcRule,
          calcParams: line.calcParams as Prisma.InputJsonValue,
          serviceDefId: line.serviceDefId,
          isOptional: line.isOptional,
          originNode,
          officeChangedAt: new Date(),
        })),
      },
    },
  });

  await saveProjectSnapshot(project.id, { ...EMPTY_COMPARE_SNAPSHOT }, originNode);
  await seedStandardCategories(project.id, originNode);
  return mapProject(project);
}

export async function getFleetProjectSnapshot(
  projectId: string,
): Promise<{ project: Project; snapshot: CompareAppSnapshot } | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, ...notDeleted },
  });
  if (!row) return null;
  const snapshot = (await loadProjectSnapshot(projectId)) ?? { ...EMPTY_COMPARE_SNAPSHOT };
  return { project: mapProject(row), snapshot };
}

export async function saveFleetProjectSnapshot(
  projectId: string,
  snapshot: CompareAppSnapshot,
  originNode?: SyncOriginNode,
): Promise<void> {
  const node = originNode ?? fleetOriginFromEnv();
  await saveProjectSnapshot(projectId, snapshot, node);
  await prisma.project.update({
    where: { id: projectId },
    data: { originNode: node, officeChangedAt: new Date() },
  });
}

export async function softDeleteFleetProject(projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...notDeleted },
  });
  if (!project) return false;

  const now = new Date();
  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: now, officeChangedAt: now },
    }),
    prisma.syncTombstone.create({
      data: {
        id: nanoid(),
        tableName: "projects",
        recordId: projectId,
        vesselId: project.vesselId,
        originNode: fleetOriginFromEnv(),
        reason: "soft_delete",
      },
    }),
  ]);
  return true;
}

export async function countFleetVendors(projectId: string): Promise<number> {
  const snap = await loadProjectSnapshot(projectId);
  return snap?.quotes.length ?? 0;
}
