import type { Prisma, VesselConditionRating } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";

export type MachineryAssetDto = {
  id: string;
  vesselId: string;
  libraryNodeId: string | null;
  department: string;
  name: string;
  maker: string | null;
  model: string | null;
  serialNumber: string | null;
  currentRunningHours: number | null;
  lastOverhaulDate: string | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  conditionRating: VesselConditionRating | null;
  healthScore: number | null;
  notes: string | null;
};

export type RunningHoursEntryDto = {
  id: string;
  machineryAssetId: string;
  machineryName: string;
  department: string;
  currentHours: number;
  lastRecordedHours: number | null;
  hourDifference: number | null;
  lastJobDoneDate: string | null;
  nextDueHours: number | null;
  nextDueDate: string | null;
  enteredBy: string;
  verifiedBy: string | null;
  recordedAt: string;
};

export type ParameterEntryDto = {
  id: string;
  machineryAssetId: string;
  machineryName: string;
  parameterKey: string;
  parameterLabel: string;
  value: string;
  unit: string | null;
  recordedAt: string;
  enteredBy: string;
};

export type ConditionReportDto = {
  id: string;
  machineryAssetId: string | null;
  machineryName: string | null;
  department: string | null;
  overallRating: VesselConditionRating;
  summary: string | null;
  deficiencies: string | null;
  recommendations: string | null;
  reportedBy: string;
  reportedAt: string;
};

function mapAsset(row: {
  id: string;
  vesselId: string;
  libraryNodeId: string | null;
  department: string;
  name: string;
  maker: string | null;
  model: string | null;
  serialNumber: string | null;
  currentRunningHours: number | null;
  lastOverhaulDate: Date | null;
  nextDueHours: number | null;
  nextDueDate: Date | null;
  conditionRating: VesselConditionRating | null;
  healthScore: number | null;
  notes: string | null;
}): MachineryAssetDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    libraryNodeId: row.libraryNodeId,
    department: row.department,
    name: row.name,
    maker: row.maker,
    model: row.model,
    serialNumber: row.serialNumber,
    currentRunningHours: row.currentRunningHours,
    lastOverhaulDate: row.lastOverhaulDate?.toISOString() ?? null,
    nextDueHours: row.nextDueHours,
    nextDueDate: row.nextDueDate?.toISOString() ?? null,
    conditionRating: row.conditionRating,
    healthScore: row.healthScore,
    notes: row.notes,
  };
}

const DEFAULT_MACHINERY_ASSETS = [
  { department: "Machinery", name: "Main Engine No.1" },
  { department: "Machinery", name: "Auxiliary Engine No.1" },
  { department: "Machinery", name: "Auxiliary Engine No.2" },
  { department: "Machinery", name: "Boiler" },
  { department: "Machinery", name: "Fresh Water Generator" },
  { department: "Electrical", name: "Auxiliary Generator No.1" },
  { department: "Electrical", name: "Auxiliary Generator No.2" },
];

export async function ensureDefaultMachineryAssets(vesselId: string): Promise<void> {
  const count = await prisma.vesselMachineryAsset.count({
    where: { vesselId, ...notDeleted },
  });
  if (count > 0) return;

  await prisma.vesselMachineryAsset.createMany({
    data: DEFAULT_MACHINERY_ASSETS.map((a) => ({ vesselId, ...a })),
  });
}

export async function listMachineryAssets(vesselId: string): Promise<MachineryAssetDto[]> {
  await ensureDefaultMachineryAssets(vesselId);
  const rows = await prisma.vesselMachineryAsset.findMany({
    where: { vesselId, ...notDeleted },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });
  return rows.map(mapAsset);
}

export async function getMachineryDashboard(vesselId: string) {
  await ensureDefaultMachineryAssets(vesselId);
  const assets = await listMachineryAssets(vesselId);

  const now = new Date();
  const overdueJobs = assets.filter(
    (a) => a.nextDueDate && new Date(a.nextDueDate) < now,
  ).length;
  const hoursDue = assets.filter(
    (a) => a.nextDueHours != null && a.currentRunningHours != null && a.currentRunningHours >= a.nextDueHours,
  ).length;
  const critical = assets.filter((a) => a.conditionRating === "critical" || a.conditionRating === "poor").length;
  const monitor = assets.filter((a) => a.conditionRating === "monitor").length;

  const healthScores = assets.map((a) => a.healthScore).filter((s): s is number => s != null);
  const avgHealth = healthScores.length
    ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
    : null;

  const upcomingOverhauls = assets
    .filter((a) => a.nextDueDate)
    .sort((a, b) => new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime())
    .slice(0, 5);

  return {
    machineryHealthScore: avgHealth,
    overdueJobs,
    runningHoursDue: hoursDue,
    criticalDeficiencies: critical,
    monitorCount: monitor,
    upcomingOverhauls,
    assetCount: assets.length,
  };
}

export async function recordRunningHours(input: {
  vesselId: string;
  machineryAssetId: string;
  department: string;
  currentHours: number;
  lastJobDoneDate?: string | null;
  nextDueHours?: number | null;
  nextDueDate?: string | null;
  enteredBy: string;
  verifiedBy?: string | null;
}) {
  const asset = await prisma.vesselMachineryAsset.findFirst({
    where: { id: input.machineryAssetId, vesselId: input.vesselId, ...notDeleted },
  });
  if (!asset) throw new Error("Machinery asset not found");

  const lastRecordedHours = asset.currentRunningHours;
  const hourDifference =
    lastRecordedHours != null ? input.currentHours - lastRecordedHours : null;

  const entry = await prisma.vesselMachineryRunningHoursEntry.create({
    data: {
      vesselId: input.vesselId,
      machineryAssetId: input.machineryAssetId,
      department: input.department,
      currentHours: input.currentHours,
      lastRecordedHours,
      hourDifference,
      lastJobDoneDate: input.lastJobDoneDate ? new Date(input.lastJobDoneDate) : null,
      nextDueHours: input.nextDueHours ?? null,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : null,
      enteredBy: input.enteredBy,
      verifiedBy: input.verifiedBy ?? null,
    },
    include: { machineryAsset: { select: { name: true } } },
  });

  await prisma.vesselMachineryAsset.update({
    where: { id: input.machineryAssetId },
    data: {
      currentRunningHours: input.currentHours,
      nextDueHours: input.nextDueHours ?? asset.nextDueHours,
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : asset.nextDueDate,
    },
  });

  return {
    id: entry.id,
    machineryAssetId: entry.machineryAssetId,
    machineryName: entry.machineryAsset.name,
    department: entry.department,
    currentHours: entry.currentHours,
    lastRecordedHours: entry.lastRecordedHours,
    hourDifference: entry.hourDifference,
    lastJobDoneDate: entry.lastJobDoneDate?.toISOString() ?? null,
    nextDueHours: entry.nextDueHours,
    nextDueDate: entry.nextDueDate?.toISOString() ?? null,
    enteredBy: entry.enteredBy,
    verifiedBy: entry.verifiedBy,
    recordedAt: entry.recordedAt.toISOString(),
  } satisfies RunningHoursEntryDto;
}

export async function listRunningHoursEntries(vesselId: string, limit = 50): Promise<RunningHoursEntryDto[]> {
  const rows = await prisma.vesselMachineryRunningHoursEntry.findMany({
    where: { vesselId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    include: { machineryAsset: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    machineryAssetId: r.machineryAssetId,
    machineryName: r.machineryAsset.name,
    department: r.department,
    currentHours: r.currentHours,
    lastRecordedHours: r.lastRecordedHours,
    hourDifference: r.hourDifference,
    lastJobDoneDate: r.lastJobDoneDate?.toISOString() ?? null,
    nextDueHours: r.nextDueHours,
    nextDueDate: r.nextDueDate?.toISOString() ?? null,
    enteredBy: r.enteredBy,
    verifiedBy: r.verifiedBy,
    recordedAt: r.recordedAt.toISOString(),
  }));
}

export async function recordParameter(input: {
  vesselId: string;
  machineryAssetId: string;
  parameterKey: string;
  parameterLabel: string;
  value: string;
  unit?: string | null;
  enteredBy: string;
}) {
  const row = await prisma.vesselMachineryParameterEntry.create({
    data: {
      vesselId: input.vesselId,
      machineryAssetId: input.machineryAssetId,
      parameterKey: input.parameterKey,
      parameterLabel: input.parameterLabel,
      value: input.value,
      unit: input.unit ?? null,
      enteredBy: input.enteredBy,
    },
    include: { machineryAsset: { select: { name: true } } },
  });
  return {
    id: row.id,
    machineryAssetId: row.machineryAssetId,
    machineryName: row.machineryAsset.name,
    parameterKey: row.parameterKey,
    parameterLabel: row.parameterLabel,
    value: row.value,
    unit: row.unit,
    recordedAt: row.recordedAt.toISOString(),
    enteredBy: row.enteredBy,
  } satisfies ParameterEntryDto;
}

export async function listParameterEntries(vesselId: string, limit = 50): Promise<ParameterEntryDto[]> {
  const rows = await prisma.vesselMachineryParameterEntry.findMany({
    where: { vesselId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    include: { machineryAsset: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    machineryAssetId: r.machineryAssetId,
    machineryName: r.machineryAsset.name,
    parameterKey: r.parameterKey,
    parameterLabel: r.parameterLabel,
    value: r.value,
    unit: r.unit,
    recordedAt: r.recordedAt.toISOString(),
    enteredBy: r.enteredBy,
  }));
}

export async function createConditionReport(input: {
  vesselId: string;
  machineryAssetId?: string | null;
  department?: string | null;
  overallRating: VesselConditionRating;
  summary?: string | null;
  deficiencies?: string | null;
  recommendations?: string | null;
  reportedBy: string;
}) {
  const row = await prisma.vesselMachineryConditionReport.create({
    data: {
      vesselId: input.vesselId,
      machineryAssetId: input.machineryAssetId ?? null,
      department: input.department ?? null,
      overallRating: input.overallRating,
      summary: input.summary ?? null,
      deficiencies: input.deficiencies ?? null,
      recommendations: input.recommendations ?? null,
      reportedBy: input.reportedBy,
    },
    include: { machineryAsset: { select: { name: true } } },
  });

  if (input.machineryAssetId) {
    const healthMap: Record<VesselConditionRating, number> = {
      excellent: 95,
      good: 80,
      monitor: 60,
      poor: 40,
      critical: 20,
    };
    await prisma.vesselMachineryAsset.update({
      where: { id: input.machineryAssetId },
      data: {
        conditionRating: input.overallRating,
        healthScore: healthMap[input.overallRating],
      },
    });
  }

  return {
    id: row.id,
    machineryAssetId: row.machineryAssetId,
    machineryName: row.machineryAsset?.name ?? null,
    department: row.department,
    overallRating: row.overallRating,
    summary: row.summary,
    deficiencies: row.deficiencies,
    recommendations: row.recommendations,
    reportedBy: row.reportedBy,
    reportedAt: row.reportedAt.toISOString(),
  } satisfies ConditionReportDto;
}

export async function listConditionReports(vesselId: string, limit = 50): Promise<ConditionReportDto[]> {
  const rows = await prisma.vesselMachineryConditionReport.findMany({
    where: { vesselId },
    orderBy: { reportedAt: "desc" },
    take: limit,
    include: { machineryAsset: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    machineryAssetId: r.machineryAssetId,
    machineryName: r.machineryAsset?.name ?? null,
    department: r.department,
    overallRating: r.overallRating,
    summary: r.summary,
    deficiencies: r.deficiencies,
    recommendations: r.recommendations,
    reportedBy: r.reportedBy,
    reportedAt: r.reportedAt.toISOString(),
  }));
}
