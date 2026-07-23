import { randomUUID } from "node:crypto";
import type {
  DdInputResponsibleRole,
  DdJobPriority,
  DdVesselJobAssignedParty,
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
  include: {
    vessel: {
      select: {
        name: true;
        code: true;
      };
    };
  };
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
    assignedParty: row.assignedParty ?? null,
    assignedAt: row.assignedAt?.toISOString() ?? null,
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
    collaborationPackageId: row.collaborationPackageId,
    formData: row.formData as Record<string, unknown> | null,
    attachmentMeta: Array.isArray(row.attachmentMeta)
      ? (row.attachmentMeta as import("@/lib/db/vesselJobAttachments").VesselJobAttachmentMeta[])
      : null,
    photoCount: row.photoCount,
    exportAssignedAt: row.exportAssignedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function buildWhere(query: ListQuery & { bankOnly?: boolean; includeArchived?: boolean }): Promise<Prisma.DdVesselJobWhereInput> {
  const vesselIds = await getScopedVesselIds();
  const where: Prisma.DdVesselJobWhereInput = { ...notDeleted };

  if (!query.includeArchived) {
    where.archivedAt = null;
  }

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

  if (query.assignedParty && query.assignedParty !== "all") {
    where.assignedParty = query.assignedParty as DdVesselJobAssignedParty;
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
  collaborationPackageId?: string | null;
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
        collaborationPackageId: input.collaborationPackageId?.trim() || null,
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

/**
 * Create multiple vessel jobs for the same machinery context, linked by one collaborationPackageId.
 * Each member keeps its own standardJobLibraryId / title / estimatedManhours so templates are not lost.
 */
export async function createCollaboratedDdVesselJobs(input: {
  vesselId: string;
  standardJobLibraryIds: string[];
  memberScopes?: Array<{
    standardJobLibraryId: string;
    machineryKey?: string | null;
    componentKey?: string | null;
  }>;
  targetDryDockProjectId?: string | null;
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
  formData?: Record<string, unknown> | null;
  createdByName?: string | null;
  createdByRole?: DdInputResponsibleRole | null;
}) {
  const uniqueIds = [...new Set(input.standardJobLibraryIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length < 2) {
    throw new Error("Select at least two standard jobs to collaborate");
  }

  const libraryNodes = await prisma.jobLibraryNode.findMany({
    where: {
      id: { in: uniqueIds },
      nodeType: "standard_job",
      ...notDeleted,
    },
    select: {
      id: true,
      name: true,
      estimatedManhours: true,
      defaultPriority: true,
      inputTemplate: true,
    },
  });

  if (libraryNodes.length !== uniqueIds.length) {
    throw new Error("One or more selected standard jobs were not found in the job library");
  }

  const nodeById = new Map(libraryNodes.map((node) => [node.id, node]));
  const orderedNodes = uniqueIds.map((id) => nodeById.get(id)!);
  const collaborationPackageId = randomUUID();
  const memberTitles = orderedNodes.map((node) => node.name);
  const status = input.status ?? "draft";
  const submittedAt = status === "submitted" ? new Date() : null;
  const baseFormData = { ...(input.formData ?? {}) };
  const scopeByJobId = new Map(
    (input.memberScopes ?? []).map((scope) => [scope.standardJobLibraryId, scope]),
  );

  const rows = await prisma.$transaction(async (tx) => {
    const created = [];
    for (let index = 0; index < orderedNodes.length; index++) {
      const node = orderedNodes[index]!;
      const memberScope = scopeByJobId.get(node.id);
      const machineryKey =
        memberScope?.machineryKey?.trim() || input.machineryKey?.trim() || null;
      const componentKey =
        memberScope?.componentKey?.trim() || input.componentKey?.trim() || null;
      const formData: Prisma.InputJsonValue = {
        ...baseFormData,
        collaborationPackageId,
        collaborationMemberCount: orderedNodes.length,
        collaborationMemberTitles: memberTitles,
        collaborationMemberIndex: index + 1,
        standardJobLibraryId: node.id,
        standardJobName: node.name,
        machineryKey,
        componentKey,
        inputTemplate: node.inputTemplate ?? null,
      };

      const row = await tx.ddVesselJob.create({
        data: {
          vesselId: input.vesselId,
          targetDryDockProjectId: input.targetDryDockProjectId?.trim() || null,
          standardJobLibraryId: node.id,
          title: node.name,
          category: input.category.trim(),
          department: input.department?.trim() || null,
          systemKey: input.systemKey?.trim() || null,
          machineryKey,
          componentKey,
          workshop: input.workshop?.trim() || null,
          description: input.description?.trim() || null,
          priority: input.priority ?? node.defaultPriority ?? "medium",
          source: input.source ?? "vessel",
          status,
          conditionRating: input.conditionRating ?? null,
          conditionDescription: input.conditionDescription?.trim() || null,
          observedDefect: input.observedDefect?.trim() || null,
          measurements: input.measurements ?? undefined,
          repairRecommendation: input.repairRecommendation?.trim() || null,
          replacementParts: input.replacementParts?.trim() || null,
          consumables: input.consumables?.trim() || null,
          estimatedManhours: node.estimatedManhours ?? null,
          estimatedCost: input.estimatedCost ?? null,
          classAttendance: input.classAttendance ?? false,
          makerAttendance: input.makerAttendance ?? false,
          operationalRisk: input.operationalRisk?.trim() || null,
          safetyRisk: input.safetyRisk?.trim() || null,
          environmentalRisk: input.environmentalRisk?.trim() || null,
          criticality: input.criticality?.trim() || null,
          lastOverhaulDate: input.lastOverhaulDate ?? null,
          runningHoursAtSurvey: input.runningHoursAtSurvey ?? null,
          // Defect is 1:1 — attach only to the first package member.
          linkedDefectId: index === 0 ? (input.linkedDefectId ?? null) : null,
          linkedPmsReference: input.linkedPmsReference?.trim() || null,
          collaborationPackageId,
          formData,
          photoCount: 0,
          createdByName: input.createdByName?.trim() || null,
          createdByRole: input.createdByRole ?? null,
          submittedAt,
        },
        include: { vessel: { select: { name: true, code: true } } },
      });
      created.push(row);
    }

    if (input.linkedDefectId && created[0]) {
      await tx.vesselDefect.updateMany({
        where: {
          id: input.linkedDefectId,
          vesselId: input.vesselId,
          ...notDeleted,
          linkedVesselJobId: null,
        },
        data: { linkedVesselJobId: created[0].id },
      });
    }

    return created;
  });

  return {
    collaborationPackageId,
    vesselJobs: rows.map(mapVesselJob),
  };
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

/** Hide job from active ship submissions lists. */
export async function archiveDdVesselJob(id: string) {
  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return null;
  if (row.archivedAt) return mapVesselJob(row);

  const updated = await prisma.ddVesselJob.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(updated);
}

async function nextJobAssignmentNumber(vesselId: string, vesselCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${vesselCode}-JA-${year}-`;
  const existing = await prisma.ddVesselJob.findMany({
    where: {
      vesselId,
      jobCode: { startsWith: prefix },
    },
    select: { jobCode: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const code = row.jobCode ?? "";
    const seqPart = code.slice(prefix.length);
    const seq = Number.parseInt(seqPart, 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

/** Assign Job Assignment Number and mark ready for shipyard export. */
export async function assignDdVesselJobForExport(id: string) {
  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted, archivedAt: null },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return null;

  const jobCode =
    row.jobCode?.trim() ||
    (await nextJobAssignmentNumber(row.vesselId, row.vessel.code));

  const updated = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      jobCode,
      exportAssignedAt: row.exportAssignedAt ?? new Date(),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(updated);
}

/** Assign (or clear) the execution / attendance party for a vessel job. */
export async function assignDdVesselJobParty(
  id: string,
  assignedParty: DdVesselJobAssignedParty | null,
) {
  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted, archivedAt: null },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return null;

  const updated = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      assignedParty,
      assignedAt: assignedParty ? new Date() : null,
      // Keep attendance flags aligned with maker / class assignment.
      ...(assignedParty === "makers_service_engineer" ? { makerAttendance: true } : {}),
      ...(assignedParty === "class" ? { classAttendance: true } : {}),
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapVesselJob(updated);
}

/**
 * Move vessel bank jobs to another vessel (same user scope).
 * Clears vessel-specific export/assignment numbers and target project links.
 */
export async function reassignDdVesselJobsToVessel(
  jobIds: string[],
  targetVesselId: string,
): Promise<
  | { ok: true; moved: number; vesselJobs: DdVesselJobDto[]; skipped: { id: string; reason: string }[] }
  | { ok: false; error: string; status: number }
> {
  const uniqueIds = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Select at least one job", status: 400 };
  }

  const targetVessel = await prisma.vessel.findFirst({
    where: { id: targetVesselId, ...notDeleted },
    select: { id: true, name: true, code: true },
  });
  if (!targetVessel) {
    return { ok: false, error: "Target vessel not found", status: 404 };
  }

  const rows = await prisma.ddVesselJob.findMany({
    where: { id: { in: uniqueIds }, ...notDeleted },
    select: {
      id: true,
      vesselId: true,
      status: true,
      archivedAt: true,
      integratedDryDockProjectId: true,
      title: true,
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  const skipped: { id: string; reason: string }[] = [];
  const movableIds: string[] = [];

  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (!row) {
      skipped.push({ id, reason: "Job not found" });
      continue;
    }
    if (row.archivedAt) {
      skipped.push({ id, reason: "Archived" });
      continue;
    }
    if (row.status === "integrated" || row.integratedDryDockProjectId) {
      skipped.push({ id, reason: "Already integrated" });
      continue;
    }
    if (row.status === "rejected") {
      skipped.push({ id, reason: "Rejected" });
      continue;
    }
    if (row.vesselId === targetVesselId) {
      skipped.push({ id, reason: "Already on target vessel" });
      continue;
    }
    movableIds.push(id);
  }

  if (movableIds.length === 0) {
    return {
      ok: true,
      moved: 0,
      vesselJobs: [],
      skipped,
    };
  }

  await prisma.ddVesselJob.updateMany({
    where: { id: { in: movableIds } },
    data: {
      vesselId: targetVesselId,
      targetDryDockProjectId: null,
      jobCode: null,
      exportAssignedAt: null,
    },
  });

  const updated = await prisma.ddVesselJob.findMany({
    where: { id: { in: movableIds } },
    include: { vessel: { select: { name: true, code: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return {
    ok: true,
    moved: updated.length,
    vesselJobs: updated.map(mapVesselJob),
    skipped,
  };
}

/** Reopen a submitted (non-integrated) job so crew can revise it. */
export async function reopenDdVesselJobForUpdate(id: string) {
  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted, archivedAt: null },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return { ok: false as const, error: "Job not found", status: 404 as const };
  if (row.status === "integrated") {
    return {
      ok: false as const,
      error: "Integrated jobs cannot be updated onboard",
      status: 400 as const,
    };
  }
  if (row.status === "rejected") {
    return {
      ok: false as const,
      error: "Rejected jobs cannot be updated onboard",
      status: 400 as const,
    };
  }
  if (row.status === "draft") {
    return { ok: true as const, vesselJob: mapVesselJob(row) };
  }

  const updated = await prisma.ddVesselJob.update({
    where: { id },
    data: {
      status: "draft",
      submittedAt: null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return { ok: true as const, vesselJob: mapVesselJob(updated) };
}

export type VesselJobPrintBundle = {
  vesselJob: DdVesselJobDto;
  vessel: {
    id: string;
    name: string;
    code: string;
    imoNumber: string | null;
    flag: string | null;
    vesselType: string | null;
    callSign: string | null;
    grossTonnage: number | null;
    yearBuilt: number | null;
    classSociety: string | null;
  };
  company: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    contactPerson: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  } | null;
  dryDockProject: {
    id: string;
    name: string;
    referenceCode: string | null;
    status: string;
    selectedYard: string | null;
    portLocation: string | null;
    plannedStart: string | null;
  } | null;
};

/** Load job + vessel + project context for shipyard PDF / print. Ensures assignment number. */
export async function getDdVesselJobPrintBundle(id: string): Promise<VesselJobPrintBundle | null> {
  const assigned = await assignDdVesselJobForExport(id);
  if (!assigned) return null;

  const row = await prisma.ddVesselJob.findFirst({
    where: { id, ...notDeleted },
    include: {
      vessel: {
        select: {
          id: true,
          name: true,
          code: true,
          imoNumber: true,
          flag: true,
          vesselType: true,
          callSign: true,
          grossTonnage: true,
          yearBuilt: true,
          classSociety: true,
          company: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
              contactPerson: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
        },
      },
      targetDryDockProject: {
        select: {
          id: true,
          name: true,
          referenceCode: true,
          status: true,
          selectedYard: true,
          portLocation: true,
          plannedStart: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    vesselJob: assigned,
    vessel: {
      id: row.vessel.id,
      name: row.vessel.name,
      code: row.vessel.code,
      imoNumber: row.vessel.imoNumber,
      flag: row.vessel.flag,
      vesselType: row.vessel.vesselType,
      callSign: row.vessel.callSign,
      grossTonnage: row.vessel.grossTonnage,
      yearBuilt: row.vessel.yearBuilt,
      classSociety: row.vessel.classSociety,
    },
    company: row.vessel.company
      ? {
          id: row.vessel.company.id,
          code: row.vessel.company.code,
          name: row.vessel.company.name,
          address: row.vessel.company.address,
          contactPerson: row.vessel.company.contactPerson,
          contactEmail: row.vessel.company.contactEmail,
          contactPhone: row.vessel.company.contactPhone,
        }
      : null,
    dryDockProject: row.targetDryDockProject
      ? {
          id: row.targetDryDockProject.id,
          name: row.targetDryDockProject.name,
          referenceCode: row.targetDryDockProject.referenceCode,
          status: row.targetDryDockProject.status,
          selectedYard: row.targetDryDockProject.selectedYard,
          portLocation: row.targetDryDockProject.portLocation,
          plannedStart: row.targetDryDockProject.plannedStart?.toISOString() ?? null,
        }
      : null,
  };
}

export async function resolveVesselIdFromProject(dryDockProjectId: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { vesselId: true },
  });
  return project?.vesselId ?? null;
}
