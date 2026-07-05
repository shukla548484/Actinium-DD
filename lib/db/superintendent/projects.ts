import type {
  DryDockProjectPriority,
  DryDockProjectStatus,
  DryDockProjectType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { provisionDryDockProjectWorkspace } from "@/lib/superintendent/engine/provisionWorkspace";
import { autoIntegrateApprovedVesselJobs } from "@/lib/db/superintendent/vesselJobs";
import { nextDryDockProjectCode } from "@/lib/superintendent/projectCodes";
import { resolveVesselScope } from "@/lib/db/superintendent/dashboard";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DryDockProjectDto, ListQuery } from "@/lib/superintendent/types";

function mapProject(
  row: Prisma.DryDockProjectGetPayload<{
    include: { vessel: { select: { name: true } } };
  }>,
): DryDockProjectDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    vesselName: row.vessel.name,
    projectId: row.projectId,
    name: row.name,
    referenceCode: row.referenceCode,
    projectType: row.projectType,
    priority: row.priority,
    status: row.status,
    plannedStart: row.plannedStart?.toISOString() ?? null,
    plannedEnd: row.plannedEnd?.toISOString() ?? null,
    actualStart: row.actualStart?.toISOString() ?? null,
    actualEnd: row.actualEnd?.toISOString() ?? null,
    selectedYard: row.selectedYard,
    budgetTotal: row.budgetTotal,
    quotedTotal: row.quotedTotal,
    actualTotal: row.actualTotal,
    progressPct: row.progressPct,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const projectInclude = {
  vessel: { select: { name: true } },
} as const;

function toDate(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function listDryDockProjects(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const vesselIds = await resolveVesselScope(query);

  if (query.employeeId && vesselIds && vesselIds.length === 0) {
    return { projects: [], total: 0, page, limit, totalPages: 0 };
  }

  const where: Prisma.DryDockProjectWhereInput = { ...notDeleted };
  if (vesselIds?.length) {
    where.vesselId = { in: vesselIds };
  } else if (query.vesselId) {
    where.vesselId = query.vesselId;
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { referenceCode: { contains: query.search, mode: "insensitive" } },
      { selectedYard: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.status && query.status !== "all") {
    where.status = query.status as DryDockProjectStatus;
  }

  const [total, rows] = await Promise.all([
    prisma.dryDockProject.count({ where }),
    prisma.dryDockProject.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ plannedStart: "desc" }, { name: "asc" }],
      include: projectInclude,
    }),
  ]);

  return {
    projects: rows.map(mapProject),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDryDockProject(id: string) {
  const row = await prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
    include: projectInclude,
  });
  if (!row) return null;
  return mapProject(row);
}

export async function createDryDockProject(input: {
  vesselId: string;
  projectId?: string | null;
  name: string;
  projectType: DryDockProjectType;
  priority?: DryDockProjectPriority;
  referenceCode?: string | null;
  status?: DryDockProjectStatus;
  plannedStart?: string | Date | null;
  plannedEnd?: string | Date | null;
  actualStart?: string | Date | null;
  actualEnd?: string | Date | null;
  expectedSailing?: string | Date | null;
  selectedYard?: string | null;
  shipyardCountry?: string | null;
  dockType?: string | null;
  currency?: string | null;
  budgetTotal?: number | null;
  approvedBudget?: number | null;
  contingencyBudget?: number | null;
  quotedTotal?: number | null;
  actualTotal?: number | null;
  offHireCost?: number | null;
  dryDockDays?: number | null;
  classSociety?: string | null;
  surveyType?: string | null;
  mainScope?: string | null;
  dockingReason?: string | null;
  portLocation?: string | null;
  projectOwner?: string | null;
  progressPct?: number | null;
  notes?: string | null;
  provisionWorkspace?: boolean;
}) {
  const referenceCode =
    input.referenceCode?.trim() || (await nextDryDockProjectCode(input.vesselId));
  const plannedStart = toDate(input.plannedStart) ?? null;

  const row = await prisma.dryDockProject.create({
    data: {
      vesselId: input.vesselId,
      projectId: input.projectId ?? null,
      name: input.name.trim(),
      referenceCode,
      projectType: input.projectType,
      priority: input.priority ?? "medium",
      status: input.status ?? "draft",
      plannedStart,
      plannedEnd: toDate(input.plannedEnd) ?? null,
      actualStart: toDate(input.actualStart) ?? null,
      actualEnd: toDate(input.actualEnd) ?? null,
      expectedSailing: toDate(input.expectedSailing) ?? null,
      selectedYard: input.selectedYard?.trim() || null,
      shipyardCountry: input.shipyardCountry?.trim() || null,
      dockType: input.dockType?.trim() || null,
      currency: input.currency?.trim() || undefined,
      budgetTotal: input.budgetTotal ?? null,
      approvedBudget: input.approvedBudget ?? null,
      contingencyBudget: input.contingencyBudget ?? null,
      quotedTotal: input.quotedTotal ?? null,
      actualTotal: input.actualTotal ?? null,
      offHireCost: input.offHireCost ?? null,
      dryDockDays: input.dryDockDays ?? null,
      classSociety: input.classSociety?.trim() || null,
      surveyType: input.surveyType?.trim() || null,
      mainScope: input.mainScope?.trim() || null,
      dockingReason: input.dockingReason?.trim() || null,
      portLocation: input.portLocation?.trim() || null,
      projectOwner: input.projectOwner?.trim() || null,
      progressPct: input.progressPct ?? 0,
      notes: input.notes?.trim() || null,
    },
    include: projectInclude,
  });

  if (input.provisionWorkspace !== false) {
    await provisionDryDockProjectWorkspace({
      dryDockProjectId: row.id,
      projectType: input.projectType,
      plannedStart,
    });
    const { integratedCount } = await autoIntegrateApprovedVesselJobs(row.id);
    if (integratedCount > 0) {
      const stamp = new Date().toISOString().slice(0, 10);
      const line = `[${stamp}] Auto-imported ${integratedCount} CE-approved vessel job(s) into project scope.`;
      const notes = row.notes?.trim() ? `${row.notes.trim()}\n${line}` : line;
      await prisma.dryDockProject.update({
        where: { id: row.id },
        data: { notes },
      });
      row.notes = notes;
    }
  }

  return mapProject(row);
}

export async function updateDryDockProject(
  id: string,
  input: Partial<{
    vesselId: string;
    projectId: string | null;
    name: string;
    referenceCode: string | null;
    status: DryDockProjectStatus;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    selectedYard: string | null;
    budgetTotal: number | null;
    quotedTotal: number | null;
    actualTotal: number | null;
    progressPct: number | null;
    notes: string | null;
  }>,
) {
  const row = await prisma.dryDockProject.update({
    where: { id },
    data: {
      ...(input.vesselId != null ? { vesselId: input.vesselId } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.referenceCode !== undefined && input.referenceCode?.trim()
        ? { referenceCode: input.referenceCode.trim() }
        : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.plannedStart !== undefined ? { plannedStart: input.plannedStart } : {}),
      ...(input.plannedEnd !== undefined ? { plannedEnd: input.plannedEnd } : {}),
      ...(input.actualStart !== undefined ? { actualStart: input.actualStart } : {}),
      ...(input.actualEnd !== undefined ? { actualEnd: input.actualEnd } : {}),
      ...(input.selectedYard !== undefined
        ? { selectedYard: input.selectedYard?.trim() || null }
        : {}),
      ...(input.budgetTotal !== undefined ? { budgetTotal: input.budgetTotal } : {}),
      ...(input.quotedTotal !== undefined ? { quotedTotal: input.quotedTotal } : {}),
      ...(input.actualTotal !== undefined ? { actualTotal: input.actualTotal } : {}),
      ...(input.progressPct !== undefined ? { progressPct: input.progressPct } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: projectInclude,
  });
  return mapProject(row);
}

export async function deleteDryDockProject(id: string) {
  await prisma.dryDockProject.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
