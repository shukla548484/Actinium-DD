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
    standardJobLibraryId: row.standardJobLibraryId,
    department: row.department,
    systemKey: row.systemKey,
    machineryKey: row.machineryKey,
    componentKey: row.componentKey,
    conditionRating: row.conditionRating,
    conditionDescription: row.conditionDescription,
    observedDefect: row.observedDefect,
    measurements: row.measurements as Record<string, unknown> | null,
    repairRecommendation: row.repairRecommendation,
    replacementParts: row.replacementParts,
    consumables: row.consumables,
    estimatedManhours: row.estimatedManhours,
    estimatedCost: row.estimatedCost,
    classAttendance: row.classAttendance,
    makerAttendance: row.makerAttendance,
    operationalRisk: row.operationalRisk,
    safetyRisk: row.safetyRisk,
    environmentalRisk: row.environmentalRisk,
    criticality: row.criticality,
    lastOverhaulDate: row.lastOverhaulDate?.toISOString() ?? null,
    runningHoursAtSurvey: row.runningHoursAtSurvey,
    ceReviewAction: row.ceReviewAction,
    ceReviewedAt: row.ceReviewedAt?.toISOString() ?? null,
    ceReviewedBy: row.ceReviewedBy,
    ceReviewNotes: row.ceReviewNotes,
    masterReviewAction: row.masterReviewAction,
    masterReviewedAt: row.masterReviewedAt?.toISOString() ?? null,
    masterReviewedBy: row.masterReviewedBy,
    linkedDefectId: row.linkedDefectId,
    linkedPmsReference: row.linkedPmsReference,
    formData: row.formData as Record<string, unknown> | null,
    attachmentMeta: Array.isArray(row.attachmentMeta)
      ? (row.attachmentMeta as import("@/lib/db/vesselJobAttachments").VesselJobAttachmentMeta[])
      : null,
    photoCount: row.photoCount,
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
  standardJobLibraryId?: string | null;
  jobCode?: string | null;
  title: string;
  category: string;
  department?: string | null;
  systemKey?: string | null;
  machineryKey?: string | null;
  componentKey?: string | null;
  workshop?: string | null;
  description?: string | null;
  priority?: DdJobPriority;
  source?: DdVesselJobSource;
  status?: DdVesselJobStatus;
  conditionRating?: import("@prisma/client").VesselConditionRating | null;
  conditionDescription?: string | null;
  observedDefect?: string | null;
  measurements?: import("@prisma/client").Prisma.InputJsonValue;
  repairRecommendation?: string | null;
  replacementParts?: string | null;
  consumables?: string | null;
  estimatedManhours?: number | null;
  estimatedCost?: number | null;
  classAttendance?: boolean;
  makerAttendance?: boolean;
  operationalRisk?: string | null;
  safetyRisk?: string | null;
  environmentalRisk?: string | null;
  criticality?: string | null;
  lastOverhaulDate?: Date | null;
  runningHoursAtSurvey?: number | null;
  linkedDefectId?: string | null;
  linkedPmsReference?: string | null;
  formData?: import("@prisma/client").Prisma.InputJsonValue;
  photoCount?: number;
  createdByName?: string | null;
  createdByRole?: DdInputResponsibleRole | null;
}) {
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.ddVesselJob.create({
      data: {
        vesselId: input.vesselId,
        targetDryDockProjectId: input.targetDryDockProjectId?.trim() || null,
        standardJobLibraryId: input.standardJobLibraryId ?? null,
        jobCode: input.jobCode?.trim() || null,
        title: input.title.trim(),
        category: input.category.trim(),
        department: input.department?.trim() || null,
        systemKey: input.systemKey?.trim() || null,
        machineryKey: input.machineryKey?.trim() || null,
        componentKey: input.componentKey?.trim() || null,
        workshop: input.workshop?.trim() || null,
        description: input.description?.trim() || null,
        priority: input.priority ?? "medium",
        source: input.source ?? "vessel",
        status: input.status ?? "draft",
        conditionRating: input.conditionRating ?? null,
        conditionDescription: input.conditionDescription?.trim() || null,
        observedDefect: input.observedDefect?.trim() || null,
        measurements: input.measurements ?? undefined,
        repairRecommendation: input.repairRecommendation?.trim() || null,
        replacementParts: input.replacementParts?.trim() || null,
        consumables: input.consumables?.trim() || null,
        estimatedManhours: input.estimatedManhours ?? null,
        estimatedCost: input.estimatedCost ?? null,
        classAttendance: input.classAttendance ?? false,
        makerAttendance: input.makerAttendance ?? false,
        operationalRisk: input.operationalRisk?.trim() || null,
        safetyRisk: input.safetyRisk?.trim() || null,
        environmentalRisk: input.environmentalRisk?.trim() || null,
        criticality: input.criticality?.trim() || null,
        lastOverhaulDate: input.lastOverhaulDate ?? null,
        runningHoursAtSurvey: input.runningHoursAtSurvey ?? null,
        linkedDefectId: input.linkedDefectId ?? null,
        linkedPmsReference: input.linkedPmsReference?.trim() || null,
        formData: input.formData ?? undefined,
        photoCount: input.photoCount ?? 0,
        createdByName: input.createdByName?.trim() || null,
        createdByRole: input.createdByRole ?? null,
        submittedAt: input.status === "submitted" ? new Date() : null,
      },
      include: { vessel: { select: { name: true, code: true } } },
    });

    if (input.linkedDefectId) {
      await tx.vesselDefect.updateMany({
        where: {
          id: input.linkedDefectId,
          vesselId: input.vesselId,
          ...notDeleted,
          linkedVesselJobId: null,
        },
        data: { linkedVesselJobId: created.id },
      });
    }

    return created;
  });
  return mapVesselJob(row);
}

export async function updateDdVesselJob(
  id: string,
  input: Partial<{
    targetDryDockProjectId: string | null;
    standardJobLibraryId: string | null;
    jobCode: string | null;
    title: string;
    category: string;
    department: string | null;
    systemKey: string | null;
    machineryKey: string | null;
    componentKey: string | null;
    workshop: string | null;
    description: string | null;
    priority: DdJobPriority;
    source: DdVesselJobSource;
    status: DdVesselJobStatus;
    conditionRating: import("@prisma/client").VesselConditionRating | null;
    conditionDescription: string | null;
    observedDefect: string | null;
    measurements: import("@prisma/client").Prisma.InputJsonValue;
    repairRecommendation: string | null;
    replacementParts: string | null;
    consumables: string | null;
    estimatedManhours: number | null;
    estimatedCost: number | null;
    classAttendance: boolean;
    makerAttendance: boolean;
    operationalRisk: string | null;
    safetyRisk: string | null;
    environmentalRisk: string | null;
    criticality: string | null;
    lastOverhaulDate: Date | null;
    runningHoursAtSurvey: number | null;
    linkedDefectId: string | null;
    linkedPmsReference: string | null;
    formData: import("@prisma/client").Prisma.InputJsonValue;
    photoCount: number;
  }>,
) {
  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      ...(input.targetDryDockProjectId !== undefined
        ? { targetDryDockProjectId: input.targetDryDockProjectId?.trim() || null }
        : {}),
      ...(input.standardJobLibraryId !== undefined
        ? { standardJobLibraryId: input.standardJobLibraryId }
        : {}),
      ...(input.jobCode !== undefined ? { jobCode: input.jobCode?.trim() || null } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.department !== undefined ? { department: input.department?.trim() || null } : {}),
      ...(input.systemKey !== undefined ? { systemKey: input.systemKey?.trim() || null } : {}),
      ...(input.machineryKey !== undefined ? { machineryKey: input.machineryKey?.trim() || null } : {}),
      ...(input.componentKey !== undefined ? { componentKey: input.componentKey?.trim() || null } : {}),
      ...(input.workshop !== undefined ? { workshop: input.workshop?.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.conditionRating !== undefined ? { conditionRating: input.conditionRating } : {}),
      ...(input.conditionDescription !== undefined
        ? { conditionDescription: input.conditionDescription?.trim() || null }
        : {}),
      ...(input.observedDefect !== undefined ? { observedDefect: input.observedDefect?.trim() || null } : {}),
      ...(input.measurements !== undefined ? { measurements: input.measurements } : {}),
      ...(input.repairRecommendation !== undefined
        ? { repairRecommendation: input.repairRecommendation?.trim() || null }
        : {}),
      ...(input.replacementParts !== undefined
        ? { replacementParts: input.replacementParts?.trim() || null }
        : {}),
      ...(input.consumables !== undefined ? { consumables: input.consumables?.trim() || null } : {}),
      ...(input.estimatedManhours !== undefined ? { estimatedManhours: input.estimatedManhours } : {}),
      ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}),
      ...(input.classAttendance !== undefined ? { classAttendance: input.classAttendance } : {}),
      ...(input.makerAttendance !== undefined ? { makerAttendance: input.makerAttendance } : {}),
      ...(input.operationalRisk !== undefined
        ? { operationalRisk: input.operationalRisk?.trim() || null }
        : {}),
      ...(input.safetyRisk !== undefined ? { safetyRisk: input.safetyRisk?.trim() || null } : {}),
      ...(input.environmentalRisk !== undefined
        ? { environmentalRisk: input.environmentalRisk?.trim() || null }
        : {}),
      ...(input.criticality !== undefined ? { criticality: input.criticality?.trim() || null } : {}),
      ...(input.lastOverhaulDate !== undefined ? { lastOverhaulDate: input.lastOverhaulDate } : {}),
      ...(input.runningHoursAtSurvey !== undefined
        ? { runningHoursAtSurvey: input.runningHoursAtSurvey }
        : {}),
      ...(input.linkedDefectId !== undefined ? { linkedDefectId: input.linkedDefectId } : {}),
      ...(input.linkedPmsReference !== undefined
        ? { linkedPmsReference: input.linkedPmsReference?.trim() || null }
        : {}),
      ...(input.formData !== undefined ? { formData: input.formData } : {}),
      ...(input.photoCount !== undefined ? { photoCount: input.photoCount } : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(row);
}

export async function ceReviewDdVesselJob(
  id: string,
  input: {
    action: import("@prisma/client").VesselJobReviewAction;
    reviewedBy: string;
    notes?: string | null;
  },
) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.status !== "submitted" && existing.status !== "draft") {
    return { ok: false as const, error: "Job is not awaiting CE review", status: 400 };
  }

  const now = new Date();
  const statusMap = {
    approved: "approved" as const,
    rejected: "rejected" as const,
    returned: "draft" as const,
    modified: "submitted" as const,
  };

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      ceReviewAction: input.action,
      ceReviewedAt: now,
      ceReviewedBy: input.reviewedBy.trim(),
      ceReviewNotes: input.notes?.trim() || null,
      status: statusMap[input.action],
      ...(input.action === "approved"
        ? { approvedAt: now, approvedByName: input.reviewedBy.trim() }
        : {}),
      ...(input.action === "rejected"
        ? {
            rejectedAt: now,
            rejectedByName: input.reviewedBy.trim(),
            rejectionReason: input.notes?.trim() || null,
          }
        : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function masterReviewDdVesselJob(
  id: string,
  input: {
    action: import("@prisma/client").VesselJobReviewAction;
    reviewedBy: string;
    notes?: string | null;
    carryForward?: boolean;
  },
) {
  const existing = await prisma.ddVesselJob.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return { ok: false as const, error: "Vessel job not found", status: 404 };
  if (existing.status !== "approved") {
    return {
      ok: false as const,
      error: "Only CE-approved jobs can receive Master review",
      status: 400,
    };
  }

  const now = new Date();
  const statusMap = {
    approved: input.carryForward ? ("carry_forward" as const) : ("approved" as const),
    rejected: "rejected" as const,
    returned: "submitted" as const,
    modified: "approved" as const,
  };

  const row = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      masterReviewAction: input.action,
      masterReviewedAt: now,
      masterReviewedBy: input.reviewedBy.trim(),
      status: statusMap[input.action],
      ...(input.action === "rejected"
        ? {
            rejectedAt: now,
            rejectedByName: input.reviewedBy.trim(),
            rejectionReason: input.notes?.trim() || null,
          }
        : {}),
      ...(input.action === "approved" && input.carryForward
        ? { carryForwardReason: input.notes?.trim() || "Master endorsed for next dry dock" }
        : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(row) };
}

export async function getVesselScopeIntegrationStats(dryDockProjectId: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { id: true, vesselId: true, workspaceProvisionedAt: true },
  });
  if (!project) return null;

  const [integratedTotal, autoImported, pendingBank, fromDefects, fromPms] = await Promise.all([
    prisma.ddVesselJob.count({
      where: { integratedDryDockProjectId: dryDockProjectId, ...notDeleted },
    }),
    prisma.ddVesselJob.count({
      where: {
        integratedDryDockProjectId: dryDockProjectId,
        integratedByName: "System (project provision)",
        ...notDeleted,
      },
    }),
    prisma.ddVesselJob.count({
      where: {
        vesselId: project.vesselId,
        integratedDryDockProjectId: null,
        status: { in: ["submitted", "approved", "carry_forward"] },
        ...notDeleted,
        OR: [
          { targetDryDockProjectId: dryDockProjectId },
          { targetDryDockProjectId: null },
        ],
      },
    }),
    prisma.ddVesselJob.count({
      where: {
        integratedDryDockProjectId: dryDockProjectId,
        linkedDefectId: { not: null },
        ...notDeleted,
      },
    }),
    prisma.ddVesselJob.count({
      where: {
        integratedDryDockProjectId: dryDockProjectId,
        linkedPmsReference: { not: null },
        ...notDeleted,
      },
    }),
  ]);

  return {
    integratedTotal,
    autoImportedAtProvision: autoImported,
    pendingInBank: pendingBank,
    integratedFromDefects: fromDefects,
    integratedFromPms: fromPms,
    workspaceProvisionedAt: project.workspaceProvisionedAt?.toISOString() ?? null,
  };
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
          description: vj.repairRecommendation ?? vj.description,
          priority: vj.priority,
          status: "planned",
          progressPct: 0,
          budgetAmount: vj.estimatedCost,
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

/** Import CE-approved / carry-forward vessel jobs into a newly provisioned project. */
export async function autoIntegrateApprovedVesselJobs(
  dryDockProjectId: string,
  integratedByName = "System (project provision)",
): Promise<{ integratedCount: number }> {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { id: true, vesselId: true },
  });
  if (!project) return { integratedCount: 0 };

  const eligible = await prisma.ddVesselJob.findMany({
    where: {
      vesselId: project.vesselId,
      ...notDeleted,
      integratedDryDockProjectId: null,
      status: { in: ["approved", "carry_forward"] },
      OR: [
        { targetDryDockProjectId: dryDockProjectId },
        { targetDryDockProjectId: null },
      ],
    },
    select: { id: true },
  });

  if (eligible.length === 0) return { integratedCount: 0 };

  const result = await integrateDdVesselJobs({
    vesselJobIds: eligible.map((j) => j.id),
    dryDockProjectId,
    integratedByName,
  });

  if (!result.ok) return { integratedCount: 0 };
  return { integratedCount: result.integrated.length };
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
