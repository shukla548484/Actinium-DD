import type { VesselConditionRating } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { saveLocalUpload } from "@/lib/storage/localUpload";

export type MachineryAssetDto = {
  id: string;
  vesselId: string;
  libraryNodeId: string | null;
  identificationNumber: string | null;
  classItemCode: string | null;
  department: string;
  name: string;
  maker: string | null;
  model: string | null;
  serialNumber: string | null;
  units: string | null;
  location: string | null;
  nameplatePhotoUrl: string | null;
  isActive: boolean;
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

export type MachineryAssetWriteInput = {
  name: string;
  department?: string | null;
  maker?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  units?: string | null;
  location?: string | null;
  notes?: string | null;
  isActive?: boolean;
  nameplatePhotoUrl?: string | null;
};

type AssetRow = {
  id: string;
  vesselId: string;
  libraryNodeId: string | null;
  identificationNumber: string | null;
  classItemCode: string | null;
  department: string;
  name: string;
  maker: string | null;
  model: string | null;
  serialNumber: string | null;
  units: string | null;
  location: string | null;
  nameplatePhotoUrl: string | null;
  isActive: boolean;
  currentRunningHours: number | null;
  lastOverhaulDate: Date | null;
  nextDueHours: number | null;
  nextDueDate: Date | null;
  conditionRating: VesselConditionRating | null;
  healthScore: number | null;
  notes: string | null;
};

function mapAsset(row: AssetRow): MachineryAssetDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    libraryNodeId: row.libraryNodeId,
    identificationNumber: row.identificationNumber ?? null,
    classItemCode: row.classItemCode ?? null,
    department: row.department,
    name: row.name,
    maker: row.maker,
    model: row.model,
    serialNumber: row.serialNumber,
    units: row.units ?? null,
    location: row.location ?? null,
    nameplatePhotoUrl: row.nameplatePhotoUrl ?? null,
    // Default Active when column/client is mid-migration or field missing.
    isActive: row.isActive !== false,
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

function sanitizeVesselCode(code: string): string {
  const cleaned = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned || "VESSEL";
}

/** Next sequential ID like VESSELCODE-MCH-0001 for the vessel. */
export async function nextMachineryIdentificationNumber(vesselId: string): Promise<string> {
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: { code: true },
  });
  const prefix = `${sanitizeVesselCode(vessel?.code ?? "VESSEL")}-MCH-`;

  const existing = await prisma.vesselMachineryAsset.findMany({
    where: {
      vesselId,
      identificationNumber: { startsWith: prefix },
    },
    select: { identificationNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const num = row.identificationNumber?.slice(prefix.length) ?? "";
    const parsed = Number.parseInt(num, 10);
    if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

async function backfillMissingIdentificationNumbers(vesselId: string): Promise<void> {
  const missing = await prisma.vesselMachineryAsset.findMany({
    where: { vesselId, identificationNumber: null, ...notDeleted },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  for (const row of missing) {
    const identificationNumber = await nextMachineryIdentificationNumber(vesselId);
    try {
      await prisma.vesselMachineryAsset.update({
        where: { id: row.id },
        data: { identificationNumber },
      });
    } catch {
      // Concurrent backfill or unique race — safe to continue.
    }
  }
}

export async function ensureDefaultMachineryAssets(vesselId: string): Promise<void> {
  const count = await prisma.vesselMachineryAsset.count({
    where: { vesselId, ...notDeleted },
  });
  if (count === 0) {
    for (const asset of DEFAULT_MACHINERY_ASSETS) {
      try {
        const identificationNumber = await nextMachineryIdentificationNumber(vesselId);
        await prisma.vesselMachineryAsset.create({
          data: { vesselId, ...asset, identificationNumber, isActive: true },
        });
      } catch {
        // Concurrent seed of defaults — continue with remaining rows.
      }
    }
  } else {
    await backfillMissingIdentificationNumbers(vesselId);
  }
}

export async function listMachineryAssets(
  vesselId: string,
  options?: { includeInactive?: boolean },
): Promise<MachineryAssetDto[]> {
  try {
    await ensureDefaultMachineryAssets(vesselId);
  } catch (err) {
    // Never fail the list endpoint because of seed/backfill races.
    console.error("[vesselMachineryAssets] ensureDefault failed", err);
  }
  const rows = await prisma.vesselMachineryAsset.findMany({
    where: {
      vesselId,
      ...notDeleted,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });
  return rows.map(mapAsset);
}

export async function getMachineryAsset(
  vesselId: string,
  assetId: string,
): Promise<MachineryAssetDto | null> {
  const row = await prisma.vesselMachineryAsset.findFirst({
    where: { id: assetId, vesselId, ...notDeleted },
  });
  return row ? mapAsset(row) : null;
}

export async function createMachineryAsset(
  vesselId: string,
  input: MachineryAssetWriteInput,
): Promise<MachineryAssetDto> {
  await ensureDefaultMachineryAssets(vesselId);
  const identificationNumber = await nextMachineryIdentificationNumber(vesselId);
  const row = await prisma.vesselMachineryAsset.create({
    data: {
      vesselId,
      identificationNumber,
      name: input.name.trim(),
      department: input.department?.trim() || "Machinery",
      maker: input.maker?.trim() || null,
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      units: input.units?.trim() || null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
      nameplatePhotoUrl: input.nameplatePhotoUrl?.trim() || null,
      isActive: input.isActive ?? true,
    },
  });
  return mapAsset(row);
}

/** Sequential batch create so identification numbers stay unique per vessel. */
export async function createMachineryAssetsBatch(
  vesselId: string,
  inputs: MachineryAssetWriteInput[],
): Promise<{ created: MachineryAssetDto[]; failed: Array<{ index: number; error: string }> }> {
  await ensureDefaultMachineryAssets(vesselId);
  const created: MachineryAssetDto[] = [];
  const failed: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    const name = input.name?.trim() ?? "";
    if (!name) {
      failed.push({ index: i, error: "Machinery name is required" });
      continue;
    }
    try {
      const asset = await createMachineryAsset(vesselId, { ...input, name });
      created.push(asset);
    } catch (err) {
      failed.push({
        index: i,
        error: err instanceof Error ? err.message : "Failed to create asset",
      });
    }
  }

  return { created, failed };
}

export async function updateMachineryAsset(
  vesselId: string,
  assetId: string,
  input: Partial<MachineryAssetWriteInput>,
): Promise<MachineryAssetDto | null> {
  const existing = await prisma.vesselMachineryAsset.findFirst({
    where: { id: assetId, vesselId, ...notDeleted },
  });
  if (!existing) return null;

  const row = await prisma.vesselMachineryAsset.update({
    where: { id: assetId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.department !== undefined
        ? { department: input.department?.trim() || existing.department }
        : {}),
      ...(input.maker !== undefined ? { maker: input.maker?.trim() || null } : {}),
      ...(input.model !== undefined ? { model: input.model?.trim() || null } : {}),
      ...(input.serialNumber !== undefined
        ? { serialNumber: input.serialNumber?.trim() || null }
        : {}),
      ...(input.units !== undefined ? { units: input.units?.trim() || null } : {}),
      ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.nameplatePhotoUrl !== undefined
        ? { nameplatePhotoUrl: input.nameplatePhotoUrl?.trim() || null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return mapAsset(row);
}

export async function softDeleteMachineryAsset(
  vesselId: string,
  assetId: string,
): Promise<boolean> {
  const existing = await prisma.vesselMachineryAsset.findFirst({
    where: { id: assetId, vesselId, ...notDeleted },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.vesselMachineryAsset.update({
    where: { id: assetId },
    data: { deletedAt: new Date(), isActive: false },
  });
  return true;
}

export async function setMachineryAssetActive(
  vesselId: string,
  assetId: string,
  isActive: boolean,
): Promise<MachineryAssetDto | null> {
  return updateMachineryAsset(vesselId, assetId, { isActive });
}

export async function saveMachineryNameplatePhoto(
  vesselId: string,
  assetId: string,
  file: File,
): Promise<string> {
  const saved = await saveLocalUpload({
    file,
    segments: ["ship-access", "machinery", vesselId, assetId],
  });
  return saved.fileUrl;
}

export async function getMachineryDashboard(vesselId: string) {
  const assets = await listMachineryAssets(vesselId);

  const now = new Date();
  const overdueJobs = assets.filter(
    (a) => a.nextDueDate && new Date(a.nextDueDate) < now,
  ).length;
  const hoursDue = assets.filter(
    (a) =>
      a.nextDueHours != null &&
      a.currentRunningHours != null &&
      a.currentRunningHours >= a.nextDueHours,
  ).length;
  const critical = assets.filter(
    (a) => a.conditionRating === "critical" || a.conditionRating === "poor",
  ).length;
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

export async function recordRunningHoursBatch(
  vesselId: string,
  readings: Array<{
    machineryAssetId: string;
    department: string;
    currentHours: number;
    lastJobDoneDate?: string | null;
    nextDueHours?: number | null;
    nextDueDate?: string | null;
    verifiedBy?: string | null;
  }>,
  enteredBy: string,
): Promise<{
  entries: RunningHoursEntryDto[];
  failed: Array<{ machineryAssetId: string; error: string }>;
}> {
  const entries: RunningHoursEntryDto[] = [];
  const failed: Array<{ machineryAssetId: string; error: string }> = [];

  for (const reading of readings) {
    try {
      const entry = await recordRunningHours({
        vesselId,
        machineryAssetId: reading.machineryAssetId,
        department: reading.department,
        currentHours: reading.currentHours,
        lastJobDoneDate: reading.lastJobDoneDate,
        nextDueHours: reading.nextDueHours,
        nextDueDate: reading.nextDueDate,
        enteredBy,
        verifiedBy: reading.verifiedBy,
      });
      entries.push(entry);
    } catch (err) {
      failed.push({
        machineryAssetId: reading.machineryAssetId,
        error: err instanceof Error ? err.message : "Failed to record running hours",
      });
    }
  }

  return { entries, failed };
}

export async function listRunningHoursEntries(
  vesselId: string,
  limit = 50,
): Promise<RunningHoursEntryDto[]> {
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

export async function listParameterEntries(
  vesselId: string,
  limit = 50,
): Promise<ParameterEntryDto[]> {
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

export async function listConditionReports(
  vesselId: string,
  limit = 50,
): Promise<ConditionReportDto[]> {
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

/** Parse create/update fields from JSON body or multipart FormData.
 * Only keys present on the source are returned (partial updates safe). */
export function parseMachineryAssetFormFields(
  source: FormData | Record<string, unknown>,
): Partial<MachineryAssetWriteInput> {
  const has = (key: string): boolean => {
    if (source instanceof FormData) return source.has(key);
    return Object.prototype.hasOwnProperty.call(source, key);
  };
  const get = (key: string): string | null => {
    if (source instanceof FormData) {
      const v = source.get(key);
      return typeof v === "string" ? v : null;
    }
    const v = source[key];
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (v == null) return null;
    return typeof v === "string" ? v : null;
  };

  const out: Partial<MachineryAssetWriteInput> = {};
  if (has("name")) out.name = get("name")?.trim() ?? "";
  if (has("department")) out.department = get("department");
  if (has("maker")) out.maker = get("maker");
  if (has("model")) out.model = get("model");
  if (has("serialNumber")) out.serialNumber = get("serialNumber");
  if (has("units")) out.units = get("units");
  if (has("location")) out.location = get("location");
  if (has("notes")) out.notes = get("notes");
  if (has("isActive")) {
    const isActiveRaw = get("isActive");
    out.isActive =
      isActiveRaw == null
        ? undefined
        : !["false", "0", "inactive", "deactive", "deactivated"].includes(
            isActiveRaw.trim().toLowerCase(),
          );
  }
  return out;
}
