import type { DdJobStatus, WorkshopJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getYardWorkProjectByProjectId } from "@/lib/db/yardExecution";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export type ShipyardSyncDirection = "pull" | "push" | "both";

function mapYardToDdStatus(status: WorkshopJobStatus): DdJobStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
    case "awaiting_owner":
    case "awaiting_class":
    case "awaiting_material":
      return "in_progress";
    case "blocked":
      return "pending_approval";
    default:
      return "planned";
  }
}

function mapDdToYardStatus(status: DdJobStatus): WorkshopJobStatus {
  switch (status) {
    case "completed":
    case "closed":
      return "completed";
    case "in_progress":
      return "in_progress";
    case "pending_approval":
      return "blocked";
    default:
      return "not_started";
  }
}

function matchJob(
  ddJob: { id: string; jobCode: string | null; title: string },
  yardJob: { id: string; jobCode: string | null; jobTitle: string },
): boolean {
  if (ddJob.jobCode && yardJob.jobCode && ddJob.jobCode === yardJob.jobCode) return true;
  return ddJob.title.trim().toLowerCase() === yardJob.jobTitle.trim().toLowerCase();
}

export async function syncShipyardExecution(
  dryDockProjectId: string,
  direction: ShipyardSyncDirection = "both",
) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { id: true, projectId: true, name: true },
  });

  if (!project) throw new Error("Dry dock project not found");
  if (!project.projectId) throw new Error("Link a tender project before syncing with shipyard execution");

  const yardData = await getYardWorkProjectByProjectId(project.projectId);
  const ddJobs = await prisma.ddJob.findMany({
    where: { dryDockProjectId, ...notDeleted },
    select: { id: true, jobCode: true, title: true, progressPct: true, status: true },
  });

  let matched = 0;
  let pulled = 0;
  let pushed = 0;

  for (const yardJob of yardData.jobs) {
    const ddJob = ddJobs.find((j) => matchJob(j, yardJob));
    if (!ddJob) continue;
    matched++;

    if (direction === "pull" || direction === "both") {
      await prisma.ddJob.update({
        where: { id: ddJob.id },
        data: {
          progressPct: yardJob.progressPct,
          status: mapYardToDdStatus(yardJob.status),
        },
      });
      ddJob.progressPct = yardJob.progressPct;
      ddJob.status = mapYardToDdStatus(yardJob.status);
      pulled++;
    }

    if (direction === "push" || direction === "both") {
      await prisma.workshopJob.update({
        where: { id: yardJob.id },
        data: {
          progressPct: ddJob.progressPct ?? 0,
          status: mapDdToYardStatus(ddJob.status),
        },
      });
      pushed++;
    }
  }

  await syncDryDockProjectProgress(dryDockProjectId);

  const syncedAt = new Date();
  await prisma.dryDockProject.update({
    where: { id: dryDockProjectId },
    data: { lastShipyardSyncAt: syncedAt },
  });

  return {
    dryDockProjectId,
    tenderProjectId: project.projectId,
    yardJobCount: yardData.jobs.length,
    superintendentJobCount: ddJobs.length,
    matched,
    pulled,
    pushed,
    syncedAt: syncedAt.toISOString(),
  };
}
