import { prisma } from "@/lib/prisma";
import { listShipyardRfqQueue } from "@/lib/db/shipyardRfq";
import { computeShipyardKpis, listYardWorkProjects } from "@/lib/db/yardExecution";
import { workshopBySlug } from "@/lib/shipyard/workshops";
import type {
  ShipyardPortalDashboard,
  ShipyardPortalProjectProgress,
  ShipyardPortalTimelineItem,
} from "@/lib/shipyard/portalDashboardTypes";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function isRunningToday(
  status: string,
  plannedStart: Date | null,
  actualStart: Date | null,
): boolean {
  if (status !== "in_progress" && status !== "not_started") return false;
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  if (actualStart && actualStart <= todayEnd) return true;
  if (plannedStart && plannedStart >= todayStart && plannedStart <= todayEnd) return true;
  return status === "in_progress";
}

export async function getShipyardPortalDashboard(): Promise<ShipyardPortalDashboard> {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [rfqQueue, yardProjects, allJobs, variations, invoices] = await Promise.all([
    listShipyardRfqQueue(),
    listYardWorkProjects(),
    prisma.workshopJob.findMany({
      include: {
        yardWorkProject: { include: { project: { select: { id: true, name: true, vesselName: true } } } },
      },
    }),
    prisma.yardVariationEntry.findMany({ where: { deletedAt: null } }),
    prisma.ddInvoice.findMany({ where: { deletedAt: null } }),
  ]);

  const executionKpis = computeShipyardKpis(
    allJobs.map((row) => ({
      id: row.id,
      yardWorkProjectId: row.yardWorkProjectId,
      workshopSlug: row.workshopSlug,
      workshopName: workshopBySlug(row.workshopSlug)?.name ?? row.workshopSlug,
      jobCode: row.jobCode,
      jobTitle: row.jobTitle,
      vesselArea: row.vesselArea,
      priority: row.priority,
      status: row.status,
      plannedStart: row.plannedStart?.toISOString() ?? null,
      plannedFinish: row.plannedFinish?.toISOString() ?? null,
      actualStart: row.actualStart?.toISOString() ?? null,
      actualFinish: row.actualFinish?.toISOString() ?? null,
      progressPct: row.progressPct,
      manpowerRequired: row.manpowerRequired,
      equipmentRequired: row.equipmentRequired,
      materialRequired: row.materialRequired,
      permitRequired: row.permitRequired,
      classHoldPoint: row.classHoldPoint,
      ownerApprovalRequired: row.ownerApprovalRequired,
      blockingDependency: row.blockingDependency,
      delayReason: row.delayReason,
      remarks: row.remarks,
      isCriticalPath: row.isCriticalPath,
      isVariation: row.isVariation,
      specLineId: row.specLineId,
      predecessorIds: [],
      successorIds: [],
    })),
  );

  const waitingRfq = rfqQueue.filter(
    (r) => r.workflowStage !== "award_received" && r.inviteStatus !== "accepted",
  ).length;

  const currentProjects = yardProjects.filter((p) => p.status !== "completed").length;

  const runningTodayJobs = allJobs.filter((j) =>
    isRunningToday(j.status, j.plannedStart, j.actualStart),
  );

  const workersToday = runningTodayJobs.reduce((sum, j) => sum + (j.manpowerRequired ?? 0), 0);

  const equipmentInUse = new Set(
    runningTodayJobs.map((j) => j.equipmentRequired).filter((e): e is string => Boolean(e?.trim())),
  );
  const allEquipment = new Set(
    allJobs.map((j) => j.equipmentRequired).filter((e): e is string => Boolean(e?.trim())),
  );
  const equipmentUtilizationPct =
    allEquipment.size === 0 ? 0 : Math.round((equipmentInUse.size / allEquipment.size) * 100);

  const criticalJobsToday = allJobs
    .filter(
      (j) =>
        j.isCriticalPath &&
        j.status !== "completed" &&
        (isRunningToday(j.status, j.plannedStart, j.actualStart) ||
          (j.plannedFinish && j.plannedFinish <= todayEnd)),
    )
    .slice(0, 8)
    .map((j) => ({
      id: j.id,
      jobTitle: j.jobTitle,
      workshopSlug: j.workshopSlug,
      workshopName: workshopBySlug(j.workshopSlug)?.name ?? j.workshopSlug,
      projectId: j.yardWorkProject.projectId,
      projectName: j.yardWorkProject.project.name,
      status: j.status,
      progressPct: j.progressPct,
      plannedFinish: j.plannedFinish?.toISOString() ?? null,
    }));

  const timeline: ShipyardPortalTimelineItem[] = yardProjects
    .filter((p) => p.plannedStart || p.plannedFinish)
    .slice(0, 6)
    .map((p) => ({
      projectId: p.projectId,
      projectName: p.project.name,
      vesselName: p.project.vesselName,
      status: p.status,
      plannedStart: p.plannedStart?.toISOString() ?? null,
      plannedFinish: p.plannedFinish?.toISOString() ?? null,
    }));

  const projectProgress: ShipyardPortalProjectProgress[] = yardProjects.slice(0, 6).map((p) => {
    const jobs = allJobs.filter((j) => j.yardWorkProjectId === p.id);
    const progressPct =
      jobs.length === 0 ? 0 : Math.round(jobs.reduce((s, j) => s + j.progressPct, 0) / jobs.length);
    return {
      projectId: p.projectId,
      projectName: p.project.name,
      vesselName: p.project.vesselName,
      status: p.status,
      progressPct,
      jobCount: jobs.length,
    };
  });

  const variationSummary = {
    pending: variations.filter((v) => !v.approved && v.ownerStatus !== "closed").length,
    approved: variations.filter((v) => v.approved).length,
    rejected: variations.filter((v) => !v.approved && v.ownerStatus === "closed").length,
  };

  const now = new Date();
  const invoiceSummary = {
    pending: invoices.filter((i) => ["draft", "submitted", "verified"].includes(i.status)).length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter(
      (i) => i.dueDate && i.dueDate < now && i.status !== "paid" && i.status !== "rejected",
    ).length,
  };

  return {
    currentProjects,
    projectsWaitingRfq: waitingRfq,
    runningToday: runningTodayJobs.length,
    delayedJobs: executionKpis.delayedJobs,
    workersToday,
    equipmentUtilizationPct,
    executionKpis,
    timeline,
    criticalJobsToday,
    projectProgress,
    variationSummary,
    invoiceSummary,
  };
}
