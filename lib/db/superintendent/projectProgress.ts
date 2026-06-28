import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

/** Roll up average job progress into DryDockProject.progressPct. */
export async function syncDryDockProjectProgress(dryDockProjectId: string): Promise<number | null> {
  const agg = await prisma.ddJob.aggregate({
    where: { dryDockProjectId, ...notDeleted },
    _avg: { progressPct: true },
    _count: { _all: true },
  });

  const progressPct =
    agg._count._all === 0 ? null : Math.round((agg._avg.progressPct ?? 0) * 10) / 10;

  await prisma.dryDockProject.update({
    where: { id: dryDockProjectId },
    data: { progressPct },
  });

  return progressPct;
}
