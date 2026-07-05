import type {
  Prisma,
  VesselRequisitionLineUrgency,
  VesselRequisitionPurpose,
  VesselRequisitionStatus,
  VesselRequisitionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import { resolveVesselIdFromProject } from "@/lib/db/superintendent/vesselJobs";
import { getScopedVesselIds } from "@/lib/superintendent/scope";
import type {
  ListVesselRequisitionsQuery,
  RequisitionLineInput,
  VesselRequisitionDto,
  VesselRequisitionLineDto,
} from "@/lib/shipAccess/requisitionDto";
import { generateVesselRequisitionNumber } from "@/lib/shipAccess/requisitionTypes";

const defectSelect = {
  id: true,
  title: true,
  equipmentSystem: true,
  equipmentLabel: true,
  location: true,
  priority: true,
  status: true,
} as const;

type RequisitionRow = Prisma.VesselRequisitionGetPayload<{
  include: {
    vessel: { select: { name: true; code: true } };
    vesselDefect: { select: typeof defectSelect };
    lines: { where: { deletedAt: null }; orderBy: { sortOrder: "asc" } };
  };
}>;

function mapLine(row: RequisitionRow["lines"][number]): VesselRequisitionLineDto {
  return {
    id: row.id,
    requisitionId: row.requisitionId,
    partName: row.partName,
    partNumber: row.partNumber,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    urgency: row.urgency,
    equipmentLabel: row.equipmentLabel,
    remarks: row.remarks,
    sortOrder: row.sortOrder,
    integratedDdSparesItemId: row.integratedDdSparesItemId,
  };
}

function mapRequisition(row: RequisitionRow): VesselRequisitionDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    vesselName: row.vessel.name,
    vesselCode: row.vessel.code,
    vesselDefectId: row.vesselDefectId,
    targetDryDockProjectId: row.targetDryDockProjectId,
    integratedDryDockProjectId: row.integratedDryDockProjectId,
    requisitionNumber: row.requisitionNumber,
    heading: row.heading,
    description: row.description,
    requisitionType: row.requisitionType,
    requisitionPurpose: row.requisitionPurpose,
    portOfSupply: row.portOfSupply,
    status: row.status,
    requestedByEmployeeId: row.requestedByEmployeeId,
    requestedByName: row.requestedByName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    masterApprovedAt: row.masterApprovedAt?.toISOString() ?? null,
    masterApprovedByName: row.masterApprovedByName,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByName: row.rejectedByName,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledByName: row.cancelledByName,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    convertedByName: row.convertedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map(mapLine),
    defect: row.vesselDefect,
  };
}

const INTEGRATABLE_STATUSES: VesselRequisitionStatus[] = ["master_approved"];

const includeRequisition = {
  vessel: { select: { name: true, code: true } },
  vesselDefect: { select: defectSelect },
  lines: { where: { ...notDeleted }, orderBy: { sortOrder: "asc" as const } },
} as const;

async function buildWhere(
  query: ListVesselRequisitionsQuery,
): Promise<Prisma.VesselRequisitionWhereInput> {
  const vesselIds = await getScopedVesselIds();
  const where: Prisma.VesselRequisitionWhereInput = { ...notDeleted };

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
    where.status = { notIn: ["converted", "cancelled"] };
  }

  if (query.status && query.status !== "all") {
    where.status = query.status as VesselRequisitionStatus;
  }

  if (query.search) {
    where.OR = [
      { heading: { contains: query.search, mode: "insensitive" } },
      { requisitionNumber: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { vesselDefect: { title: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

async function nextRequisitionSequence(vesselId: string, year: number): Promise<number> {
  const yearSuffix = year.toString().slice(-2);
  const count = await prisma.vesselRequisition.count({
    where: {
      vesselId,
      requisitionNumber: { contains: `.SPR.${yearSuffix}.` },
    },
  });
  return count + 1;
}

async function assertDefectEligibleForRequisition(vesselDefectId: string, vesselId: string) {
  const defect = await prisma.vesselDefect.findFirst({
    where: { id: vesselDefectId, vesselId, ...notDeleted },
    include: { requisition: true },
  });

  if (!defect) {
    return { ok: false as const, error: "Defect not found for this vessel" };
  }
  if (defect.status !== "master_approved") {
    return { ok: false as const, error: "Only Master-approved defects can have requisitions" };
  }
  if (defect.requisition && !defect.requisition.deletedAt) {
    return { ok: false as const, error: "This defect already has a requisition" };
  }

  return { ok: true as const, defect };
}

function lineCreateData(
  lines: RequisitionLineInput[],
  defaultEquipmentLabel?: string | null,
): Prisma.VesselRequisitionLineCreateWithoutRequisitionInput[] {
  return lines.map((line, index) => ({
    partName: line.partName,
    partNumber: line.partNumber ?? null,
    description: line.description ?? null,
    quantity: line.quantity ?? 1,
    unit: line.unit ?? "pcs",
    urgency: (line.urgency ?? "normal") as VesselRequisitionLineUrgency,
    equipmentLabel: line.equipmentLabel ?? defaultEquipmentLabel ?? null,
    remarks: line.remarks ?? null,
    sortOrder: index,
  }));
}

export async function listVesselRequisitions(query: ListVesselRequisitionsQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = await buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.vesselRequisition.count({ where }),
    prisma.vesselRequisition.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: includeRequisition,
    }),
  ]);

  return {
    requisitions: rows.map(mapRequisition),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getVesselRequisition(id: string) {
  const row = await prisma.vesselRequisition.findFirst({
    where: { id, ...notDeleted },
    include: includeRequisition,
  });
  if (!row) return null;
  return mapRequisition(row);
}

export async function createVesselRequisition(input: {
  vesselId: string;
  vesselDefectId: string;
  targetDryDockProjectId?: string | null;
  heading: string;
  description?: string | null;
  requisitionType?: VesselRequisitionType;
  requisitionPurpose?: VesselRequisitionPurpose;
  portOfSupply?: string | null;
  status?: VesselRequisitionStatus;
  requestedByEmployeeId?: string | null;
  requestedByName?: string | null;
  lines: RequisitionLineInput[];
}) {
  const eligibility = await assertDefectEligibleForRequisition(input.vesselDefectId, input.vesselId);
  if (!eligibility.ok) {
    throw new Error(eligibility.error);
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: input.vesselId, ...notDeleted },
    select: { code: true },
  });
  if (!vessel) throw new Error("Vessel not found");

  const year = new Date().getFullYear();
  const sequence = await nextRequisitionSequence(input.vesselId, year);
  const requisitionNumber = generateVesselRequisitionNumber(vessel.code, year, sequence);
  const status = input.status ?? "draft";

  const row = await prisma.vesselRequisition.create({
    data: {
      vesselId: input.vesselId,
      vesselDefectId: input.vesselDefectId,
      targetDryDockProjectId: input.targetDryDockProjectId ?? null,
      requisitionNumber,
      heading: input.heading,
      description: input.description ?? null,
      requisitionType: input.requisitionType ?? "spr",
      requisitionPurpose: input.requisitionPurpose ?? "defect_closer",
      portOfSupply: input.portOfSupply ?? null,
      status,
      requestedByEmployeeId: input.requestedByEmployeeId ?? null,
      requestedByName: input.requestedByName ?? null,
      submittedAt: status === "submitted" ? new Date() : null,
      lines: {
        create: lineCreateData(input.lines, eligibility.defect.equipmentLabel),
      },
    },
    include: includeRequisition,
  });

  return mapRequisition(row);
}

export async function updateVesselRequisition(
  id: string,
  input: {
    heading?: string;
    description?: string | null;
    portOfSupply?: string | null;
    requisitionPurpose?: VesselRequisitionPurpose;
    status?: VesselRequisitionStatus;
    cancelledByName?: string | null;
    lines?: RequisitionLineInput[];
    defaultEquipmentLabel?: string | null;
  },
) {
  const data: Prisma.VesselRequisitionUpdateInput = {
    heading: input.heading,
    description: input.description,
    portOfSupply: input.portOfSupply,
    requisitionPurpose: input.requisitionPurpose,
    status: input.status,
  };

  if (input.status === "submitted") {
    data.submittedAt = new Date();
  }
  if (input.status === "cancelled") {
    data.cancelledAt = new Date();
    data.cancelledByName = input.cancelledByName ?? null;
  }

  if (input.lines) {
    await prisma.vesselRequisitionLine.updateMany({
      where: { requisitionId: id, ...notDeleted },
      data: { deletedAt: new Date() },
    });
    data.lines = {
      create: lineCreateData(input.lines, input.defaultEquipmentLabel),
    };
  }

  const row = await prisma.vesselRequisition.update({
    where: { id },
    data,
    include: includeRequisition,
  });
  return mapRequisition(row);
}

export async function deleteVesselRequisition(id: string) {
  await prisma.$transaction([
    prisma.vesselRequisitionLine.updateMany({
      where: { requisitionId: id },
      data: { deletedAt: new Date() },
    }),
    prisma.vesselRequisition.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);
}

export async function masterReviewVesselRequisition(
  id: string,
  input: {
    action: "approve" | "reject";
    actorName?: string | null;
    actorEmployeeId?: string | null;
    rejectionReason?: string | null;
  },
) {
  const now = new Date();
  const data: Prisma.VesselRequisitionUpdateInput =
    input.action === "approve"
      ? {
          status: "master_approved",
          masterApprovedAt: now,
          masterApprovedByName: input.actorName ?? null,
          masterApprovedByEmployeeId: input.actorEmployeeId ?? null,
        }
      : {
          status: "rejected",
          rejectedAt: now,
          rejectedByName: input.actorName ?? null,
          rejectionReason: input.rejectionReason ?? null,
        };

  const row = await prisma.vesselRequisition.update({
    where: { id },
    data,
    include: includeRequisition,
  });
  return mapRequisition(row);
}

export async function listRequisitionEligibleDefects(vesselId: string) {
  const defects = await prisma.vesselDefect.findMany({
    where: {
      vesselId,
      status: "master_approved",
      ...notDeleted,
      requisition: null,
    },
    orderBy: [{ masterApprovedAt: "desc" }, { createdAt: "desc" }],
    include: { vessel: { select: { name: true, code: true } } },
  });

  return defects.map((row) => ({
    id: row.id,
    vesselId: row.vesselId,
    title: row.title,
    equipmentSystem: row.equipmentSystem,
    equipmentLabel: row.equipmentLabel,
    location: row.location,
    priority: row.priority,
    masterApprovedAt: row.masterApprovedAt?.toISOString() ?? null,
  }));
}

export function isRequisitionEditableByCrew(status: VesselRequisitionStatus): boolean {
  return status === "draft" || status === "rejected";
}

export function isRequisitionCancellableByCrew(status: VesselRequisitionStatus): boolean {
  return status === "draft" || status === "submitted";
}

function buildSparesNotes(input: {
  requisitionNumber: string;
  defectTitle: string;
  line: RequisitionRow["lines"][number];
}): string {
  const parts = [
    `Vessel req ${input.requisitionNumber}`,
    `Defect: ${input.defectTitle}`,
    input.line.equipmentLabel ? `Equipment: ${input.line.equipmentLabel}` : null,
    input.line.urgency !== "normal" ? `Urgency: ${input.line.urgency}` : null,
    input.line.remarks ? input.line.remarks : null,
    input.line.description ? input.line.description : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function integrateVesselRequisitions(input: {
  requisitionIds: string[];
  dryDockProjectId: string;
  convertedByName?: string | null;
}) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: input.dryDockProjectId, ...notDeleted },
    select: { id: true, vesselId: true },
  });
  if (!project) return { ok: false as const, error: "Dry dock project not found", status: 404 };

  const requisitions = await prisma.vesselRequisition.findMany({
    where: {
      id: { in: input.requisitionIds },
      ...notDeleted,
      vesselId: project.vesselId,
      integratedDryDockProjectId: null,
      status: { in: INTEGRATABLE_STATUSES },
    },
    include: {
      vesselDefect: { select: { title: true } },
      lines: { where: { ...notDeleted }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (requisitions.length === 0) {
    return {
      ok: false as const,
      error: "No eligible vessel requisitions found for integration",
      status: 400,
    };
  }

  if (requisitions.length !== input.requisitionIds.length) {
    return {
      ok: false as const,
      error:
        "Some selected requisitions are ineligible (wrong vessel, already converted, or wrong status)",
      status: 400,
    };
  }

  const now = new Date();
  const convertedByName = input.convertedByName?.trim() || null;

  const results = await prisma.$transaction(async (tx) => {
    const converted: { requisitionId: string; sparesItemIds: string[] }[] = [];

    for (const req of requisitions) {
      if (req.lines.length === 0) {
        throw new Error(`Requisition ${req.requisitionNumber} has no line items`);
      }

      const sparesItemIds: string[] = [];

      for (const line of req.lines) {
        const sparesItem = await tx.ddSparesItem.create({
          data: {
            dryDockProjectId: project.id,
            partName: line.partName,
            partNumber: line.partNumber,
            quantity: line.quantity,
            supplyType: "owner",
            status: "required",
            notes: buildSparesNotes({
              requisitionNumber: req.requisitionNumber,
              defectTitle: req.vesselDefect.title,
              line,
            }),
          },
        });

        await tx.vesselRequisitionLine.update({
          where: { id: line.id },
          data: { integratedDdSparesItemId: sparesItem.id },
        });

        sparesItemIds.push(sparesItem.id);
      }

      await tx.vesselRequisition.update({
        where: { id: req.id },
        data: {
          status: "converted",
          integratedDryDockProjectId: project.id,
          convertedAt: now,
          convertedByName,
        },
      });

      converted.push({ requisitionId: req.id, sparesItemIds });
    }

    return converted;
  });

  return { ok: true as const, converted: results };
}

export { resolveVesselIdFromProject };
