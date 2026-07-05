import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { createDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { getMachineryDashboard, listMachineryAssets } from "@/lib/db/vesselMachineryAssets";

export type VesselDryDockReadinessDto = {
  readinessPct: number;
  jobsProposed: number;
  jobsApproved: number;
  jobsIntegrated: number;
  jobsPendingReview: number;
  jobsRejected: number;
  photosUploaded: number;
  measurementsCount: number;
  estimatedBudget: number;
  pmsJobsLinked: number;
  defectsLinked: number;
  machineryHealthScore: number | null;
  criticalJobs: number;
  overdueMaintenanceCount: number;
};

export async function getVesselDryDockReadiness(
  vesselId: string,
  dryDockProjectId?: string | null,
): Promise<VesselDryDockReadinessDto> {
  const jobWhere = {
    vesselId,
    ...notDeleted,
    ...(dryDockProjectId
      ? {
          OR: [
            { targetDryDockProjectId: dryDockProjectId },
            { integratedDryDockProjectId: dryDockProjectId },
            { targetDryDockProjectId: null, integratedDryDockProjectId: null },
          ],
        }
      : {}),
  };

  const [jobs, defectsLinked, machineryDash] = await Promise.all([
    prisma.ddVesselJob.findMany({
      where: jobWhere,
      select: {
        status: true,
        priority: true,
        photoCount: true,
        measurements: true,
        estimatedCost: true,
        linkedPmsReference: true,
        linkedDefectId: true,
        formData: true,
        conditionDescription: true,
      },
    }),
    prisma.vesselDefect.count({
      where: { vesselId, linkedVesselJobId: { not: null }, ...notDeleted },
    }),
    getMachineryDashboard(vesselId),
  ]);

  const jobsProposed = jobs.filter((j) => j.status !== "draft").length;
  const jobsApproved = jobs.filter((j) =>
    ["approved", "integrated", "carry_forward"].includes(j.status),
  ).length;
  const jobsIntegrated = jobs.filter((j) => j.status === "integrated").length;
  const jobsPendingReview = jobs.filter((j) => j.status === "submitted").length;
  const jobsRejected = jobs.filter((j) => j.status === "rejected").length;
  const criticalJobs = jobs.filter((j) => j.priority === "critical").length;
  const photosUploaded = jobs.reduce((sum, j) => sum + j.photoCount, 0);
  const measurementsCount = jobs.filter((j) => j.measurements != null).length;
  const estimatedBudget = jobs.reduce((sum, j) => sum + (j.estimatedCost ?? 0), 0);
  const pmsJobsLinked = jobs.filter((j) => j.linkedPmsReference).length;

  const jobScore = jobs.length
    ? (jobsApproved / jobs.length) * 40 +
      (jobsPendingReview / jobs.length) * 20 +
      (jobs.filter((j) => j.conditionDescription || j.formData).length / jobs.length) * 20
    : 0;
  const machineryScore = (machineryDash.machineryHealthScore ?? 0) * 0.25;
  const defectScore = Math.min(defectsLinked * 2, 10);
  const readinessPct = Math.round(Math.min(100, jobScore + machineryScore + defectScore));

  return {
    readinessPct,
    jobsProposed,
    jobsApproved,
    jobsIntegrated,
    jobsPendingReview,
    jobsRejected,
    photosUploaded,
    measurementsCount,
    estimatedBudget,
    pmsJobsLinked,
    defectsLinked,
    machineryHealthScore: machineryDash.machineryHealthScore,
    criticalJobs,
    overdueMaintenanceCount: machineryDash.overdueJobs + machineryDash.runningHoursDue,
  };
}

export async function proposeOverdueMaintenanceJobs(input: {
  vesselId: string;
  targetDryDockProjectId?: string | null;
  createdByName?: string | null;
}) {
  const assets = await listMachineryAssets(input.vesselId);
  const now = new Date();
  const overdue = assets.filter(
    (a) =>
      (a.nextDueDate && new Date(a.nextDueDate) < now) ||
      (a.nextDueHours != null &&
        a.currentRunningHours != null &&
        a.currentRunningHours >= a.nextDueHours),
  );

  const existingPmsRefs = new Set(
    (
      await prisma.ddVesselJob.findMany({
        where: {
          vesselId: input.vesselId,
          ...notDeleted,
          linkedPmsReference: { not: null },
          status: { notIn: ["rejected", "integrated"] },
        },
        select: { linkedPmsReference: true },
      })
    ).map((j) => j.linkedPmsReference!),
  );

  const created = [];
  for (const asset of overdue) {
    const pmsRef = `asset:${asset.id}`;
    if (existingPmsRefs.has(pmsRef)) continue;

    const job = await createDdVesselJob({
      vesselId: input.vesselId,
      targetDryDockProjectId: input.targetDryDockProjectId ?? null,
      title: `Overdue maintenance — ${asset.name}`,
      category: "miscellaneous",
      department: asset.department,
      workshop: asset.department,
      description: `PMS overdue for ${asset.name}. Current hours: ${asset.currentRunningHours ?? "—"}. Next due: ${asset.nextDueDate ? new Date(asset.nextDueDate).toLocaleDateString() : asset.nextDueHours ?? "—"}.`,
      priority: "high",
      source: "pms",
      status: "draft",
      linkedPmsReference: pmsRef,
      createdByName: input.createdByName ?? "PMS monitor",
      createdByRole: "vessel",
    });
    created.push(job);
  }

  return { proposed: created.length, jobs: created };
}
