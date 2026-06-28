import type { CompareAppSnapshot } from "@/lib/desktop/snapshot";
import type { SyncOriginNode } from "@/lib/sync/constants";
import { prisma } from "@/lib/prisma";
import { mapCompareSnapshot } from "@/lib/db/mappers";

export async function listCompareSnapshots(projectId: string) {
  const rows = await prisma.compareSnapshot.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapCompareSnapshot);
}

export async function upsertCompareSnapshot(input: {
  id?: string;
  projectId: string;
  inviteId?: string | null;
  vendorName: string;
  fileName: string;
  snapshot: CompareAppSnapshot;
  originNode?: SyncOriginNode;
}) {
  const now = new Date();
  const data = {
    projectId: input.projectId,
    inviteId: input.inviteId ?? null,
    vendorName: input.vendorName,
    fileName: input.fileName,
    snapshot: input.snapshot as object,
    originNode: input.originNode ?? "ship",
    officeChangedAt: now,
  };

  if (input.id) {
    const row = await prisma.compareSnapshot.update({
      where: { id: input.id },
      data,
    });
    return mapCompareSnapshot(row);
  }

  const row = await prisma.compareSnapshot.create({ data });
  return mapCompareSnapshot(row);
}

export async function deleteCompareSnapshot(id: string): Promise<void> {
  const now = new Date();
  await prisma.compareSnapshot.update({
    where: { id },
    data: { deletedAt: now, officeChangedAt: now },
  });
}
