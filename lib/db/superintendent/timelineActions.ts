import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export async function rescheduleProjectMilestones(
  dryDockProjectId: string,
  updates: { id: string; plannedDate: string | null }[],
) {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.ddMilestone.updateMany({
        where: { id: u.id, dryDockProjectId, ...notDeleted },
        data: { plannedDate: u.plannedDate ? new Date(u.plannedDate) : null },
      }),
    ),
  );

  return getMilestoneDates(dryDockProjectId);
}

export async function lockProjectBaseline(dryDockProjectId: string) {
  const milestones = await prisma.ddMilestone.findMany({
    where: { dryDockProjectId, ...notDeleted },
    select: { id: true, plannedDate: true },
  });

  const now = new Date();
  await prisma.$transaction([
    ...milestones.map((m) =>
      prisma.ddMilestone.update({
        where: { id: m.id },
        data: { baselineDate: m.plannedDate },
      }),
    ),
    prisma.dryDockProject.update({
      where: { id: dryDockProjectId },
      data: { baselineLockedAt: now },
    }),
  ]);

  return { baselineLockedAt: now.toISOString(), milestoneCount: milestones.length };
}

async function getMilestoneDates(dryDockProjectId: string) {
  const rows = await prisma.ddMilestone.findMany({
    where: { dryDockProjectId, ...notDeleted },
    orderBy: { sortOrder: "asc" },
    select: { id: true, plannedDate: true, baselineDate: true },
  });
  return rows.map((r) => ({
    id: r.id,
    plannedDate: r.plannedDate?.toISOString() ?? null,
    baselineDate: r.baselineDate?.toISOString() ?? null,
  }));
}
