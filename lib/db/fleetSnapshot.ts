import type { CompareAppSnapshot } from "@/lib/desktop/snapshot";
import { EMPTY_COMPARE_SNAPSHOT } from "@/lib/desktop/snapshot";
import type { SyncOriginNode } from "@/lib/sync/constants";
import { prisma } from "@/lib/prisma";

/** Single workspace blob per project (superintendent/ship compare UI state). */
export const WORKSPACE_SNAPSHOT_VENDOR = "__workspace__";

export async function loadProjectSnapshot(
  projectId: string,
): Promise<CompareAppSnapshot | null> {
  const row = await prisma.compareSnapshot.findFirst({
    where: {
      projectId,
      vendorName: WORKSPACE_SNAPSHOT_VENDOR,
      deletedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return { ...EMPTY_COMPARE_SNAPSHOT, ...(row.snapshot as unknown as CompareAppSnapshot) };
}

export async function saveProjectSnapshot(
  projectId: string,
  snapshot: CompareAppSnapshot,
  originNode: SyncOriginNode,
): Promise<void> {
  const now = new Date();
  const existing = await prisma.compareSnapshot.findFirst({
    where: {
      projectId,
      vendorName: WORKSPACE_SNAPSHOT_VENDOR,
      deletedAt: null,
    },
  });

  if (existing) {
    await prisma.compareSnapshot.update({
      where: { id: existing.id },
      data: {
        snapshot: snapshot as object,
        originNode,
        officeChangedAt: now,
      },
    });
    return;
  }

  await prisma.compareSnapshot.create({
    data: {
      projectId,
      vendorName: WORKSPACE_SNAPSHOT_VENDOR,
      fileName: "workspace.json",
      snapshot: snapshot as object,
      originNode,
      officeChangedAt: now,
    },
  });
}

export async function saveVendorCompareSnapshot(input: {
  projectId: string;
  inviteId?: string | null;
  vendorName: string;
  fileName: string;
  snapshot: Record<string, unknown>;
  originNode: SyncOriginNode;
}): Promise<void> {
  const now = new Date();
  const existing = await prisma.compareSnapshot.findFirst({
    where: {
      projectId: input.projectId,
      vendorName: input.vendorName,
      fileName: input.fileName,
      deletedAt: null,
    },
  });

  if (existing) {
    await prisma.compareSnapshot.update({
      where: { id: existing.id },
      data: {
        inviteId: input.inviteId ?? null,
        snapshot: input.snapshot as object,
        originNode: input.originNode,
        officeChangedAt: now,
      },
    });
    return;
  }

  await prisma.compareSnapshot.create({
    data: {
      projectId: input.projectId,
      inviteId: input.inviteId ?? null,
      vendorName: input.vendorName,
      fileName: input.fileName,
      snapshot: input.snapshot as object,
      originNode: input.originNode,
      officeChangedAt: now,
    },
  });
}
