import type { SyncOriginNode } from "@/lib/sync/constants";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import type { Prisma } from "@prisma/client";

export interface RecordTombstoneInput {
  tableName: string;
  recordId: string;
  businessKey?: string;
  vesselId?: string;
  originNode?: SyncOriginNode;
  reason?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

export async function recordSyncTombstone(input: RecordTombstoneInput): Promise<void> {
  await prisma.syncTombstone.create({
    data: {
      id: nanoid(),
      tableName: input.tableName,
      recordId: input.recordId,
      businessKey: input.businessKey ?? null,
      vesselId: input.vesselId ?? null,
      originNode: input.originNode ?? "office",
      reason: input.reason ?? null,
      source: input.source ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function softDeleteProject(
  projectId: string,
  options?: { vesselId?: string; originNode?: SyncOriginNode; reason?: string },
): Promise<void> {
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
        vesselId: options?.vesselId ?? null,
        originNode: options?.originNode ?? "office",
        reason: options?.reason ?? "soft_delete",
      },
    }),
  ]);
}
