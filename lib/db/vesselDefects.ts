import type { DdJobPriority, Prisma, VesselDefectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { VesselDefectDto, ListVesselDefectsQuery } from "@/lib/shipAccess/defectTypes";
import type { VesselDefectEquipmentSystem } from "@/lib/shipAccess/crewDefectSystems";

type DefectRow = Prisma.VesselDefectGetPayload<{
  include: { vessel: { select: { name: true; code: true } } };
}>;

function mapDefect(row: DefectRow): VesselDefectDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    vesselName: row.vessel.name,
    vesselCode: row.vessel.code,
    equipmentSystem: row.equipmentSystem as VesselDefectEquipmentSystem,
    equipmentLabel: row.equipmentLabel,
    location: row.location,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    reportedByEmployeeId: row.reportedByEmployeeId,
    reportedByName: row.reportedByName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    masterApprovedAt: row.masterApprovedAt?.toISOString() ?? null,
    masterApprovedByName: row.masterApprovedByName,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByName: row.rejectedByName,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledByName: row.cancelledByName,
    linkedVesselJobId: row.linkedVesselJobId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(query: ListVesselDefectsQuery): Prisma.VesselDefectWhereInput {
  const where: Prisma.VesselDefectWhereInput = { ...notDeleted };

  if (query.vesselId) {
    where.vesselId = query.vesselId;
  }

  if (query.status && query.status !== "all") {
    where.status = query.status as VesselDefectStatus;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { equipmentLabel: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { location: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function listVesselDefects(query: ListVesselDefectsQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.vesselDefect.count({ where }),
    prisma.vesselDefect.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: { vessel: { select: { name: true, code: true } } },
    }),
  ]);

  return {
    defects: rows.map(mapDefect),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getVesselDefect(id: string) {
  const row = await prisma.vesselDefect.findFirst({
    where: { id, ...notDeleted },
    include: { vessel: { select: { name: true, code: true } } },
  });
  if (!row) return null;
  return mapDefect(row);
}

export async function createVesselDefect(input: {
  vesselId: string;
  equipmentSystem: VesselDefectEquipmentSystem;
  equipmentLabel?: string | null;
  location?: string | null;
  title: string;
  description?: string | null;
  priority?: DdJobPriority;
  status?: VesselDefectStatus;
  reportedByEmployeeId?: string | null;
  reportedByName?: string | null;
}) {
  const status = input.status ?? "draft";
  const row = await prisma.vesselDefect.create({
    data: {
      vesselId: input.vesselId,
      equipmentSystem: input.equipmentSystem,
      equipmentLabel: input.equipmentLabel ?? null,
      location: input.location ?? null,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      status,
      reportedByEmployeeId: input.reportedByEmployeeId ?? null,
      reportedByName: input.reportedByName ?? null,
      submittedAt: status === "submitted" ? new Date() : null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapDefect(row);
}

export async function updateVesselDefect(
  id: string,
  input: {
    equipmentSystem?: VesselDefectEquipmentSystem;
    equipmentLabel?: string | null;
    location?: string | null;
    title?: string;
    description?: string | null;
    priority?: DdJobPriority;
    status?: VesselDefectStatus;
    cancelledByName?: string | null;
  },
) {
  const data: Prisma.VesselDefectUpdateInput = {
    equipmentSystem: input.equipmentSystem,
    equipmentLabel: input.equipmentLabel,
    location: input.location,
    title: input.title,
    description: input.description,
    priority: input.priority,
    status: input.status,
  };

  if (input.status === "submitted") {
    data.submittedAt = new Date();
  }
  if (input.status === "cancelled") {
    data.cancelledAt = new Date();
    data.cancelledByName = input.cancelledByName ?? null;
  }

  const row = await prisma.vesselDefect.update({
    where: { id },
    data,
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapDefect(row);
}

export async function deleteVesselDefect(id: string) {
  await prisma.vesselDefect.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function masterReviewVesselDefect(
  id: string,
  input: {
    action: "approve" | "reject";
    actorName?: string | null;
    actorEmployeeId?: string | null;
    rejectionReason?: string | null;
  },
) {
  const now = new Date();
  const data: Prisma.VesselDefectUpdateInput =
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

  const row = await prisma.vesselDefect.update({
    where: { id },
    data,
    include: { vessel: { select: { name: true, code: true } } },
  });
  return mapDefect(row);
}

export function isDefectEditableByCrew(status: VesselDefectStatus): boolean {
  return status === "draft" || status === "rejected";
}

export function isDefectCancellableByCrew(status: VesselDefectStatus): boolean {
  return status === "draft" || status === "submitted";
}
