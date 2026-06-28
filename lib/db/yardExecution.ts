import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  CRITICAL_PATH_JOB_CODES,
  DEPENDENCY_CHAIN_LINKS,
  WORKSHOPS,
  workshopBySlug,
  workshopForSpecBucket,
} from "@/lib/shipyard/workshops";
import type { ShipyardDashboardKpis, WorkshopJobRecord } from "@/lib/shipyard/types";

const jobInclude = {
  predecessors: { include: { predecessor: true } },
  successors: { include: { successor: true } },
  specLine: true,
} satisfies Prisma.WorkshopJobInclude;

function mapJob(row: Prisma.WorkshopJobGetPayload<{ include: typeof jobInclude }>): WorkshopJobRecord {
  return {
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
    predecessorIds: row.predecessors.map((d) => d.predecessorJobId),
    successorIds: row.successors.map((d) => d.successorJobId),
  };
}

export async function getOrCreateYardWorkProject(projectId: string) {
  const existing = await prisma.yardWorkProject.findUnique({
    where: { projectId },
    include: { project: true },
  });
  if (existing) return existing;

  return prisma.yardWorkProject.create({
    data: { projectId },
    include: { project: true },
  });
}

export async function listYardWorkProjects() {
  return prisma.yardWorkProject.findMany({
    include: {
      project: true,
      jobs: { select: { id: true, status: true, workshopSlug: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getYardWorkProjectByProjectId(projectId: string) {
  const ywp = await getOrCreateYardWorkProject(projectId);
  const jobs = await prisma.workshopJob.findMany({
    where: { yardWorkProjectId: ywp.id },
    include: jobInclude,
    orderBy: [{ sortOrder: "asc" }, { jobTitle: "asc" }],
  });
  return { yardWorkProject: ywp, jobs: jobs.map(mapJob) };
}

async function linkJobsByCode(
  codeToId: Map<string, string>,
  links: { predecessorCode: string; successorCode: string; lagDays?: number }[],
) {
  for (const link of links) {
    const predId = codeToId.get(link.predecessorCode);
    const succId = codeToId.get(link.successorCode);
    if (!predId || !succId) continue;
    await prisma.workshopJobDependency
      .create({
        data: {
          predecessorJobId: predId,
          successorJobId: succId,
          lagDays: link.lagDays ?? 0,
        },
      })
      .catch(() => undefined);
  }
}

async function linkSequentialByCodePrefix(
  prefix: string,
  codeToId: Map<string, string>,
) {
  const codes = [...codeToId.keys()]
    .filter((c) => c.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (let i = 1; i < codes.length; i++) {
    const predId = codeToId.get(codes[i - 1]!);
    const succId = codeToId.get(codes[i]!);
    if (predId && succId) {
      await prisma.workshopJobDependency
        .create({ data: { predecessorJobId: predId, successorJobId: succId } })
        .catch(() => undefined);
    }
  }
}

async function markCriticalPathJobs(yardWorkProjectId: string) {
  await prisma.workshopJob.updateMany({
    where: { yardWorkProjectId, jobCode: { in: CRITICAL_PATH_JOB_CODES } },
    data: { isCriticalPath: true },
  });
}

export async function initWorkshopJobsFromSpec(projectId: string, includeDependencyChain = true) {
  const ywp = await getOrCreateYardWorkProject(projectId);
  const existing = await prisma.workshopJob.count({ where: { yardWorkProjectId: ywp.id } });
  if (existing > 0) {
    return getYardWorkProjectByProjectId(projectId);
  }

  const specLines = await prisma.specLine.findMany({
    where: { projectId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }],
  });

  const codeToId = new Map<string, string>();

  for (let i = 0; i < specLines.length; i++) {
    const line = specLines[i]!;
    const workshop = workshopForSpecBucket(line.bucket);
    const job = await prisma.workshopJob.create({
      data: {
        yardWorkProjectId: ywp.id,
        workshopSlug: workshop.slug,
        jobCode: line.lineCode,
        jobTitle: line.descriptionEn,
        specLineId: line.id,
        sortOrder: i,
        classHoldPoint: line.bucket === "class_statutory",
        ownerApprovalRequired: line.ownerLocked,
      },
    });
    if (job.jobCode) codeToId.set(job.jobCode, job.id);
  }

  if (includeDependencyChain) {
    await linkJobsByCode(codeToId, DEPENDENCY_CHAIN_LINKS);
    await linkSequentialByCodePrefix("HP-", codeToId);
    await linkSequentialByCodePrefix("PC-", codeToId);
    await markCriticalPathJobs(ywp.id);
  }

  await prisma.yardWorkProject.update({
    where: { id: ywp.id },
    data: { status: "planning" },
  });

  return getYardWorkProjectByProjectId(projectId);
}

export function computeShipyardKpis(jobs: WorkshopJobRecord[]): ShipyardDashboardKpis {
  const total = jobs.length;
  const notStarted = jobs.filter((j) => j.status === "not_started").length;
  const inProgress = jobs.filter((j) => j.status === "in_progress").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const criticalPath = jobs.filter((j) => j.isCriticalPath && j.status !== "completed").length;
  const delayed = jobs.filter((j) => j.delayReason || j.status === "blocked").length;
  const awaitingOwner = jobs.filter(
    (j) => j.status === "awaiting_owner" || (j.ownerApprovalRequired && j.status !== "completed"),
  ).length;
  const awaitingClass = jobs.filter(
    (j) => j.status === "awaiting_class" || (j.classHoldPoint && j.status !== "completed"),
  ).length;
  const awaitingMaterial = jobs.filter((j) => j.status === "awaiting_material").length;
  const variations = jobs.filter((j) => j.isVariation).length;
  const actualProgress = total === 0 ? 0 : jobs.reduce((s, j) => s + j.progressPct, 0) / total;
  const plannedProgress =
    total === 0
      ? 0
      : jobs.reduce((s, j) => s + (j.plannedFinish ? Math.min(j.progressPct + 20, 100) : j.progressPct), 0) /
        total;

  return {
    totalJobs: total,
    jobsNotStarted: notStarted,
    jobsInProgress: inProgress,
    jobsCompleted: completed,
    criticalPathJobs: criticalPath,
    delayedJobs: delayed,
    awaitingOwnerApproval: awaitingOwner,
    awaitingClassInspection: awaitingClass,
    awaitingMaterial,
    awaitingAccessStaging: jobs.filter((j) => j.blockingDependency).length,
    variationJobs: variations,
    plannedVsActualPct: { planned: Math.round(plannedProgress), actual: Math.round(actualProgress) },
    budgetedVsWorkDone: { budgeted: 100, workDone: Math.round(actualProgress) },
  };
}

export async function getShipyardDashboardKpis(projectId?: string): Promise<ShipyardDashboardKpis> {
  if (projectId) {
    const { jobs } = await getYardWorkProjectByProjectId(projectId);
    return computeShipyardKpis(jobs);
  }

  const projects = await listYardWorkProjects();
  const allJobs = await prisma.workshopJob.findMany({ include: jobInclude });
  const kpis = computeShipyardKpis(allJobs.map(mapJob));
  return { ...kpis, activeProjects: projects.filter((p) => p.status !== "completed").length };
}

export async function listWorkshopJobs(
  yardWorkProjectId: string,
  workshopSlug?: string,
): Promise<WorkshopJobRecord[]> {
  const rows = await prisma.workshopJob.findMany({
    where: {
      yardWorkProjectId,
      ...(workshopSlug ? { workshopSlug } : {}),
    },
    include: jobInclude,
    orderBy: [{ sortOrder: "asc" }, { jobTitle: "asc" }],
  });
  return rows.map(mapJob);
}

export async function updateWorkshopJob(
  jobId: string,
  data: Partial<{
    status: WorkshopJobRecord["status"];
    progressPct: number;
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
    delayReason: string | null;
    remarks: string | null;
    priority: WorkshopJobRecord["priority"];
    vesselArea: string | null;
    manpowerRequired: number | null;
    equipmentRequired: string | null;
    materialRequired: string | null;
    permitRequired: string | null;
  }>,
) {
  const row = await prisma.workshopJob.update({
    where: { id: jobId },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.progressPct !== undefined ? { progressPct: data.progressPct } : {}),
      ...(data.plannedStart !== undefined
        ? { plannedStart: data.plannedStart ? new Date(data.plannedStart) : null }
        : {}),
      ...(data.plannedFinish !== undefined
        ? { plannedFinish: data.plannedFinish ? new Date(data.plannedFinish) : null }
        : {}),
      ...(data.actualStart !== undefined
        ? { actualStart: data.actualStart ? new Date(data.actualStart) : null }
        : {}),
      ...(data.actualFinish !== undefined
        ? { actualFinish: data.actualFinish ? new Date(data.actualFinish) : null }
        : {}),
      ...(data.delayReason !== undefined ? { delayReason: data.delayReason } : {}),
      ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.vesselArea !== undefined ? { vesselArea: data.vesselArea } : {}),
      ...(data.manpowerRequired !== undefined ? { manpowerRequired: data.manpowerRequired } : {}),
      ...(data.equipmentRequired !== undefined ? { equipmentRequired: data.equipmentRequired } : {}),
      ...(data.materialRequired !== undefined ? { materialRequired: data.materialRequired } : {}),
      ...(data.permitRequired !== undefined ? { permitRequired: data.permitRequired } : {}),
    },
    include: jobInclude,
  });
  return mapJob(row);
}

export async function addJobDependency(successorJobId: string, predecessorJobId: string, lagDays = 0) {
  await prisma.workshopJobDependency.create({
    data: { successorJobId, predecessorJobId, lagDays },
  });
}

export async function removeJobDependency(successorJobId: string, predecessorJobId: string) {
  await prisma.workshopJobDependency.deleteMany({
    where: { successorJobId, predecessorJobId },
  });
}

export { WORKSHOPS };
