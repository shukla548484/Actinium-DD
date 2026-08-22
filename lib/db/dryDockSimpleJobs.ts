import type { DdJobPriority, DdSimpleJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import {
  areaLabelForCode,
  prepMethodLabelForCode,
} from "@/lib/dryDockJobs/catalog";
import type {
  DdSimpleJobCoatLineInput,
  DdSimpleJobDto,
  DdSimpleJobPrepLineInput,
  ListDdSimpleJobsQuery,
} from "@/lib/dryDockJobs/types";

type JobRow = Prisma.DdSimpleJobGetPayload<{
  include: {
    vessel: { select: { name: true; code: true } };
    prepLines: true;
    coatLines: true;
  };
}>;

function mapJob(row: JobRow): DdSimpleJobDto {
  const prepLines = [...row.prepLines].sort((a, b) => a.sortOrder - b.sortOrder);
  const coatLines = [...row.coatLines].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: row.id,
    vesselId: row.vesselId,
    vesselName: row.vessel.name,
    vesselCode: row.vessel.code,
    family: row.family,
    jobType: row.jobType,
    title: row.title,
    notes: row.notes,
    priority: row.priority,
    status: row.status,
    createdByEmployeeId: row.createdByEmployeeId,
    createdByName: row.createdByName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedByName: row.approvedByName,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByName: row.rejectedByName,
    rejectionReason: row.rejectionReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledByName: row.cancelledByName,
    prepLines: prepLines.map((line) => ({
      id: line.id,
      areaCode: line.areaCode,
      areaLabel: line.areaLabel,
      prepMethodCode: line.prepMethodCode,
      prepMethodLabel: line.prepMethodLabel,
      areaSqm: line.areaSqm,
      notes: line.notes,
      sortOrder: line.sortOrder,
    })),
    coatLines: coatLines.map((line) => ({
      id: line.id,
      areaCode: line.areaCode,
      areaLabel: line.areaLabel,
      primerCoats: line.primerCoats,
      binderCoats: line.binderCoats,
      finishCoats: line.finishCoats,
      dftRequired: line.dftRequired,
      dftUm: line.dftUm,
      notes: line.notes,
      sortOrder: line.sortOrder,
    })),
    totalPrepSqm: prepLines.reduce((sum, line) => sum + (line.areaSqm || 0), 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const jobInclude = {
  vessel: { select: { name: true, code: true } },
  prepLines: true,
  coatLines: true,
} satisfies Prisma.DdSimpleJobInclude;

function buildWhere(query: ListDdSimpleJobsQuery): Prisma.DdSimpleJobWhereInput {
  const where: Prisma.DdSimpleJobWhereInput = { ...notDeleted };

  if (query.vesselId) where.vesselId = query.vesselId;
  if (query.status && query.status !== "all") {
    where.status = query.status as DdSimpleJobStatus;
  }
  if (query.jobType && query.jobType !== "all") {
    where.jobType = query.jobType;
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { notes: { contains: query.search, mode: "insensitive" } },
      { jobType: { contains: query.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function normalizePrepLines(lines: DdSimpleJobPrepLineInput[]) {
  return lines.map((line, index) => ({
    areaCode: line.areaCode,
    areaLabel: line.areaLabel ?? areaLabelForCode(line.areaCode),
    prepMethodCode: line.prepMethodCode,
    prepMethodLabel: line.prepMethodLabel ?? prepMethodLabelForCode(line.prepMethodCode),
    areaSqm: line.areaSqm,
    notes: line.notes ?? null,
    sortOrder: line.sortOrder ?? index,
  }));
}

function normalizeCoatLines(lines: DdSimpleJobCoatLineInput[]) {
  return lines.map((line, index) => ({
    areaCode: line.areaCode,
    areaLabel: line.areaLabel ?? areaLabelForCode(line.areaCode),
    primerCoats: line.primerCoats ?? 0,
    binderCoats: line.binderCoats ?? 0,
    finishCoats: line.finishCoats ?? 0,
    dftRequired: line.dftRequired ?? false,
    dftUm: line.dftUm ?? null,
    notes: line.notes ?? null,
    sortOrder: line.sortOrder ?? index,
  }));
}

export async function listDdSimpleJobs(query: ListDdSimpleJobsQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const where = buildWhere(query);

  const [total, rows] = await Promise.all([
    prisma.ddSimpleJob.count({ where }),
    prisma.ddSimpleJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: jobInclude,
    }),
  ]);

  return {
    jobs: rows.map(mapJob),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getDdSimpleJob(id: string) {
  const row = await prisma.ddSimpleJob.findFirst({
    where: { id, ...notDeleted },
    include: jobInclude,
  });
  if (!row) return null;
  return mapJob(row);
}

export async function createDdSimpleJob(input: {
  vesselId: string;
  family?: "paint";
  jobType: string;
  title: string;
  notes?: string | null;
  priority?: DdJobPriority;
  status?: DdSimpleJobStatus;
  createdByEmployeeId?: string | null;
  createdByName?: string | null;
  prepLines?: DdSimpleJobPrepLineInput[];
  coatLines?: DdSimpleJobCoatLineInput[];
}) {
  const status = input.status ?? "draft";
  const row = await prisma.ddSimpleJob.create({
    data: {
      vesselId: input.vesselId,
      family: input.family ?? "paint",
      jobType: input.jobType,
      title: input.title,
      notes: input.notes ?? null,
      priority: input.priority ?? "medium",
      status,
      createdByEmployeeId: input.createdByEmployeeId ?? null,
      createdByName: input.createdByName ?? null,
      submittedAt: status === "submitted" ? new Date() : null,
      prepLines: {
        create: normalizePrepLines(input.prepLines ?? []),
      },
      coatLines: {
        create: normalizeCoatLines(input.coatLines ?? []),
      },
    },
    include: jobInclude,
  });
  return mapJob(row);
}

export async function updateDdSimpleJob(
  id: string,
  input: {
    jobType?: string;
    title?: string;
    notes?: string | null;
    priority?: DdJobPriority;
    status?: DdSimpleJobStatus;
    createdByName?: string | null;
    prepLines?: DdSimpleJobPrepLineInput[];
    coatLines?: DdSimpleJobCoatLineInput[];
    cancel?: boolean;
    cancelledByName?: string | null;
  },
) {
  const existing = await prisma.ddSimpleJob.findFirst({
    where: { id, ...notDeleted },
  });
  if (!existing) return null;

  if (input.cancel) {
    const row = await prisma.ddSimpleJob.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByName: input.cancelledByName ?? null,
      },
      include: jobInclude,
    });
    return mapJob(row);
  }

  const data: Prisma.DdSimpleJobUpdateInput = {};
  if (input.jobType !== undefined) data.jobType = input.jobType;
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.createdByName !== undefined) data.createdByName = input.createdByName;
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "submitted" && !existing.submittedAt) {
      data.submittedAt = new Date();
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    if (input.prepLines) {
      await tx.ddSimpleJobPrepLine.deleteMany({ where: { jobId: id } });
      await tx.ddSimpleJobPrepLine.createMany({
        data: normalizePrepLines(input.prepLines).map((line) => ({ ...line, jobId: id })),
      });
    }
    if (input.coatLines) {
      await tx.ddSimpleJobCoatLine.deleteMany({ where: { jobId: id } });
      await tx.ddSimpleJobCoatLine.createMany({
        data: normalizeCoatLines(input.coatLines).map((line) => ({ ...line, jobId: id })),
      });
    }
    return tx.ddSimpleJob.update({
      where: { id },
      data,
      include: jobInclude,
    });
  });

  return mapJob(row);
}

export async function masterReviewDdSimpleJob(
  id: string,
  input: {
    action: "approve" | "reject";
    actorName?: string | null;
    actorEmployeeId?: string | null;
    rejectionReason?: string | null;
  },
) {
  const existing = await prisma.ddSimpleJob.findFirst({
    where: { id, ...notDeleted },
  });
  if (!existing) return null;
  if (existing.status !== "submitted") {
    throw new Error("Only submitted jobs can be reviewed");
  }

  const row = await prisma.ddSimpleJob.update({
    where: { id },
    data:
      input.action === "approve"
        ? {
            status: "approved",
            approvedAt: new Date(),
            approvedByName: input.actorName ?? null,
            approvedByEmployeeId: input.actorEmployeeId ?? null,
            rejectedAt: null,
            rejectedByName: null,
            rejectionReason: null,
          }
        : {
            status: "rejected",
            rejectedAt: new Date(),
            rejectedByName: input.actorName ?? null,
            rejectionReason: input.rejectionReason ?? null,
          },
    include: jobInclude,
  });
  return mapJob(row);
}

export async function softDeleteDdSimpleJob(id: string) {
  const existing = await prisma.ddSimpleJob.findFirst({
    where: { id, ...notDeleted },
  });
  if (!existing) return null;
  await prisma.ddSimpleJob.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
