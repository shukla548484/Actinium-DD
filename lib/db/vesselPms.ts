import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { listMachineryAssets } from "@/lib/db/vesselMachineryAssets";

export type PmsItemStatus = "overdue" | "due_soon" | "ok" | "no_schedule";

export type PmsScheduleItemDto = {
  assetId: string;
  assetName: string;
  department: string;
  currentRunningHours: number | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  lastOverhaulDate: string | null;
  conditionRating: string | null;
  healthScore: number | null;
  status: PmsItemStatus;
  linkedJobId: string | null;
  linkedJobStatus: string | null;
  pmsReference: string;
};

function resolvePmsStatus(input: {
  nextDueDate: Date | null;
  nextDueHours: number | null;
  currentRunningHours: number | null;
}): PmsItemStatus {
  const now = new Date();
  const dueSoonCutoff = new Date(now);
  dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 30);

  if (input.nextDueDate) {
    const due = new Date(input.nextDueDate);
    if (due < now) return "overdue";
    if (due <= dueSoonCutoff) return "due_soon";
    return "ok";
  }

  if (
    input.nextDueHours != null &&
    input.currentRunningHours != null &&
    input.currentRunningHours >= input.nextDueHours
  ) {
    return "overdue";
  }

  if (input.nextDueHours != null || input.nextDueDate) return "ok";
  return "no_schedule";
}

export async function listVesselPmsSchedule(vesselId: string): Promise<{
  items: PmsScheduleItemDto[];
  summary: { overdue: number; dueSoon: number; ok: number; noSchedule: number; linkedJobs: number };
}> {
  const [assets, linkedJobs] = await Promise.all([
    listMachineryAssets(vesselId),
    prisma.ddVesselJob.findMany({
      where: {
        vesselId,
        ...notDeleted,
        linkedPmsReference: { not: null },
        status: { notIn: ["rejected", "integrated"] },
      },
      select: { id: true, status: true, linkedPmsReference: true },
    }),
  ]);

  const jobByPmsRef = new Map(
    linkedJobs
      .filter((j) => j.linkedPmsReference)
      .map((j) => [j.linkedPmsReference!, j]),
  );

  const items: PmsScheduleItemDto[] = assets.map((asset) => {
    const pmsReference = `asset:${asset.id}`;
    const linked = jobByPmsRef.get(pmsReference);
    const status = resolvePmsStatus({
      nextDueDate: asset.nextDueDate ? new Date(asset.nextDueDate) : null,
      nextDueHours: asset.nextDueHours,
      currentRunningHours: asset.currentRunningHours,
    });

    return {
      assetId: asset.id,
      assetName: asset.name,
      department: asset.department,
      currentRunningHours: asset.currentRunningHours,
      nextDueHours: asset.nextDueHours,
      nextDueDate: asset.nextDueDate,
      lastOverhaulDate: asset.lastOverhaulDate,
      conditionRating: asset.conditionRating,
      healthScore: asset.healthScore,
      status,
      linkedJobId: linked?.id ?? null,
      linkedJobStatus: linked?.status ?? null,
      pmsReference,
    };
  });

  items.sort((a, b) => {
    const rank: Record<PmsItemStatus, number> = {
      overdue: 0,
      due_soon: 1,
      ok: 2,
      no_schedule: 3,
    };
    return rank[a.status] - rank[b.status] || a.assetName.localeCompare(b.assetName);
  });

  return {
    items,
    summary: {
      overdue: items.filter((i) => i.status === "overdue").length,
      dueSoon: items.filter((i) => i.status === "due_soon").length,
      ok: items.filter((i) => i.status === "ok").length,
      noSchedule: items.filter((i) => i.status === "no_schedule").length,
      linkedJobs: items.filter((i) => i.linkedJobId).length,
    },
  };
}
