import type {
  DdInputResponsibleRole,
  DdJobPriority,
  DdVesselJobSource,
  DdVesselJobStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import { getScopedVesselIds } from "@/lib/superintendent/scope";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import type { DdVesselJobDto, ListQuery } from "@/lib/superintendent/types";

const INTEGRATABLE_STATUSES: DdVesselJobStatus[] = ["submitted", "approved", "carry_forward"];

type VesselJobRow = Prisma.DdVesselJobGetPayload<{
  include: { vessel: { select: { name: true; code: true } } };
}>;

function mapVesselJob(row: VesselJobRow): DdVesselJobDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    vesselName: row.vessel.name,
    vesselCode: row.vessel.code,
    targetDryDockProjectId: row.targetDryDockProjectId,
    integratedDryDockProjectId: row.integratedDryDockProjectId,
    integratedDdJobId: row.integratedDdJobId,
    jobCode: row.jobCode,
    title: row.title,
    category: row.category,
    workshop: row.workshop,
    description: row.description,
    priority: row.priority,
    source: row.source,
    status: row.status,
    createdByName: row.createdByName,
    createdByRole: row.createdByRole,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByName: row.approvedByName,
    integratedAt: row.integratedAt?.toISOString() ?? null,
    integratedByName: row.integratedByName,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByName: row.rejectedByName,
    rejectionReason: row.rejectionReason,
    carryForwardReason: row.carryForwardReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function buildWhere(query: ListQuery & { bankOnly?: boolean }): Promise<Prisma.DdVesselJobWhereInput> {
  const vesselIds = await getScopedVesselIds();
  const where: Prisma.DdVesselJobWhereInput = { ...notDeleted };

  if (vesselIds !== undefined) {
    if (vesselIds.length === 0) {
      where.vesselId = { in: [] };
    } else if (query.vesselId) {
      where.vesselId = vesselIds.includes(query.vesselId) ? query.vesselId : { in: [] };
    } else {
      where.vesselId = { in: vesselIds };
    }
  } else if (query.vesselId) {
    where.vesselId = query.vesselId;
  }

  if (query.dryDockProjectId) {
    const project = await prisma.dryDockProject.findFirst({
      where: { id: query.dryDockProjectId, ...notDeleted },
      select: { vesselId: true },
    });
    if (project) {
      where.vesselId = project.vesselId;
      where.integratedDryDockProjectId = null;
      where.status = { in: INTEGRATABLE_STATUSES };
    }
  }

  if (query.bankOnly) {
    where.integratedDryDockProjectId = null;
    where.status = { notIn: ["integrated", "rejected"] };
  }

  if (query.status && query.status !== "all") {
    where.status = query.status as DdVesselJobStatus;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { jobCode: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listDdVesselJobs(query: ListQuery & { bankOnly?: boolean } = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = await buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddVesselJob.count({ where }),
    prisma.ddVesselJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: { vessel: { select: { name: true, code: true } } },
    }),
  ]);

  return {
    vesselJobs: rows.map(mapVesselJob),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdVesselJob(id: string) {
  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return null;
  return mapVesselJob(row);
}

export async function createDdVesselJob(input: {
  vesselId: string;
  targetDryDockProjectId?: string | null;
  jobCode?: string | null;
  title: string;
  category: string;
  workshop?: string | null;
  description?: string | null;
  priority?: DdJobPriority;
  source?: DdVesselJobSource;
  status?: DdVesselJobStatus;
  createdByName?: string | null;
  createdByRole?: DdInputResponsibleRole | null;
}) {
  const row = await prisma.ddVesselJob.create({
    data: {
      vesselId: input.vesselId,
      targetDryDockProjectId: input.targetDryDockProjectId?.trim() || null,
      jobCode: input.jobCode?.trim() || null,
      title: input.title.trim(),
      category: input.category.trim(),
      workshop: input.workshop?.trim() || null,
      description: input.description?.trim() || null,
      priority: input.priority ?? "medium",
      source: input.source ?? "vessel",
      status: input.status ?? "draft",
      createdByName: input.createdByName?.trim() || null,
      createdByRole: input.createdByRole ?? null,
      submittedAt: input.status === "submitted" ? new Date() : null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(row);
}

export async function updateDdVesselJob(
  id: string,
  input: Partial<{
    targetDryDockProjectId: string | null;
    jobCode: string | null;
    title: string;
    category: string;
    workshop: string | null;
    description: string | null;
    priority: DdJobPriority;
    source: DdVesselJobSource;
    status: DdVesselJobStatus;
  }>,
) {
  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      ...(input.targetDryDockProjectId !== undefined
        ? { targetDryDockProjectId: input.targetDryDockProjectId?.trim() || null }
        : {}),
      ...(input.jobCode !== undefined ? { jobCode: input.jobCode?.trim() || null } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.workshop !== undefined ? { workshop: input.workshop?.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(row);
}

export async function submitDdVesselJob(id: string, submittedByName?: string | null) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.status !== "draft") {
    return { ok: false as const, error: "Only draft jobs can be submitted", status: 400 };
  }

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      ...(submittedByName?.trim() ? { createdByName: submittedByName.trim() } : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function approveDdVesselJob(id: string, approvedByName?: string | null) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.status !== "submitted") {
    return { ok: false as const, error: "Only submitted jobs can be approved", status: 400 };
  }

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedByName: approvedByName?.trim() || null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function rejectDdVesselJob(
  id: string,
  input: { rejectedByName?: string | null; rejectionReason?: string | null },
) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.status === "integrated" || existing.status === "rejected") {
    return {
      ok: false as const,
      error: "Integrated or rejected jobs cannot be rejected again",
      status: 400,
    };
  }

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      status: "rejected",
      rejectedAt: new Date(),
      rejectedByName: input.rejectedByName?.trim() || null,
      rejectionReason: input.rejectionReason?.trim() || null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function carryForwardDdVesselJob(
  id: string,
  input: { carryForwardReason?: string | null },
) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.integratedDryDockProjectId) {
    return { ok: false as const, error: "Integrated jobs cannot be carried forward", status: 400 };
  }
  if (!["submitted", "approved"].includes(existing.status)) {
    return {
      ok: false as const,
      error: "Only submitted or approved jobs can be marked carry-forward",
      status: 400,
    };
  }

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      status: "carry_forward",
      carryForwardReason: input.carryForwardReason?.trim() || null,
      targetDryDockProjectId: null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function integrateDdVesselJobs(input: {
  vesselJobIds: string[];
  dryDockProjectId: string;
  integratedByName?: string | null;
}) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: input.dryDockProjectId, ...notDeleted },
    select: { id: true, vesselId: true },
  });
  if (!project) return { ok: false as const, error: "Dry dock project not found", status: 404 };

  const vesselJobs = await prisma.ddVesselJob.findMany({
    where: {
      id: { in: input.vesselJobIds },
      ...notDeleted,
      vesselId: project.vesselId,
      integratedDryDockProjectId: null,
      status: { in: INTEGRATABLE_STATUSES },
    },
  });

  if (vesselJobs.length === 0) {
    return {
      ok: false as const,
      error: "No eligible vessel jobs found for integration",
      status: 400,
    };
  }

  if (vesselJobs.length !== input.vesselJobIds.length) {
    return {
      ok: false as const,
      error: "Some selected jobs are ineligible (wrong vessel, already integrated, or wrong status)",
      status: 400,
    };
  }

  const maxSort = await prisma.ddJob.aggregate({
    where: { dryDockProjectId: project.id, ...notDeleted },
    _max: { sortOrder: true },
  });
  let nextSort = (maxSort._max.sortOrder ?? -1) + 1;
  const now = new Date();
  const integratedByName = input.integratedByName?.trim() || null;

  const results = await prisma.$transaction(async (tx) => {
    const created: { vesselJobId: string; ddJobId: string }[] = [];

    for (const vj of vesselJobs) {
      const ddJob = await tx.ddJob.create({
        data: {
          dryDockProjectId: project.id,
          jobCode: vj.jobCode,
          title: vj.title,
          category: vj.category,
          workshop: vj.workshop,
          description: vj.description,
          priority: vj.priority,
          status: "planned",
          progressPct: 0,
          sortOrder: nextSort++,
        },
      });

      await tx.ddVesselJob.update({
        where: { id: vj.id },
        data: {
          status: "integrated",
          integratedDryDockProjectId: project.id,
          integratedDdJobId: ddJob.id,
          integratedAt: now,
          integratedByName,
        },
      });

      created.push({ vesselJobId: vj.id, ddJobId: ddJob.id });
    }

    return created;
  });

  await syncDryDockProjectProgress(project.id);

  return { ok: true as const, integrated: results };
}

export async function softDeleteDdVesselJob(id: string) {
  await prisma.ddVesselJob.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function resolveVesselIdFromProject(dryDockProjectId: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { vesselId: true },
  });
  return project?.vesselId ?? null;
}
