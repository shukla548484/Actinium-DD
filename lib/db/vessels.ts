import type { EntityStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bumpVesselCode, generateVesselCode, normalizeVesselCode } from "@/lib/admin/codes";
import type { ListQuery, VesselDto } from "@/lib/admin/types";

const notDeleted = { deletedAt: null };

function mapVessel(
  row: Prisma.VesselGetPayload<{
    include: {
      company: { select: { name: true; code: true } };
      _count: { select: { employeeVessels: true } };
    };
  }>,
): VesselDto {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company?.name,
    companyCode: row.company?.code,
    code: row.code,
    name: row.name,
    imoNumber: row.imoNumber,
    flag: row.flag,
    vesselType: row.vesselType,
    callSign: row.callSign,
    grossTonnage: row.grossTonnage,
    yearBuilt: row.yearBuilt,
    status: row.status,
    employeeCount: row._count?.employeeVessels,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listVessels(query: ListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.VesselWhereInput = { ...notDeleted };
  if (query.companyId) where.companyId = query.companyId;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { imoNumber: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.status && query.status !== "all") {
    where.status = query.status;
  }

  const [total, rows] = await Promise.all([
    prisma.vessel.count({ where }),
    prisma.vessel.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        company: { select: { name: true, code: true } },
        _count: { select: { employeeVessels: true } },
      },
    }),
  ]);

  return {
    vessels: rows.map(mapVessel),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getVessel(id: string) {
  const row = await prisma.vessel.findFirst({
    where: { id, ...notDeleted },
    include: {
      company: { select: { id: true, name: true, code: true } },
      _count: { select: { employeeVessels: true, projects: true } },
      employeeVessels: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapVessel(row as Parameters<typeof mapVessel>[0]),
    company: row.company,
    projectCount: row._count.projects,
    assignedEmployees: row.employeeVessels.map((ev) => ({
      id: ev.employee.id,
      employeeCode: ev.employee.employeeCode,
      name: `${ev.employee.firstName} ${ev.employee.lastName}`,
      status: ev.employee.status,
      isWatchKeeper: ev.isWatchKeeper,
      assignedAt: ev.assignedAt.toISOString(),
    })),
  };
}

async function uniqueVesselCode(companyId: string, base: string): Promise<string> {
  const normalized = normalizeVesselCode(base);
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const code = bumpVesselCode(normalized, attempt);
    const existing = await prisma.vessel.findFirst({
      where: { companyId, code, ...notDeleted },
    });
    if (!existing) return code;
  }
  throw new Error("Unable to generate a unique vessel code");
}

export async function createVessel(input: {
  companyId: string;
  name: string;
  code?: string;
  imoNumber?: string | null;
  flag?: string | null;
  vesselType?: string | null;
  callSign?: string | null;
  grossTonnage?: number | null;
  yearBuilt?: number | null;
  status?: EntityStatus;
}) {
  const code = await uniqueVesselCode(
    input.companyId,
    input.code?.trim() ? normalizeVesselCode(input.code) : generateVesselCode(input.name),
  );
  const row = await prisma.vessel.create({
    data: {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      imoNumber: input.imoNumber?.trim() || null,
      flag: input.flag?.trim() || null,
      vesselType: input.vesselType?.trim() || null,
      callSign: input.callSign?.trim() || null,
      grossTonnage: input.grossTonnage ?? null,
      yearBuilt: input.yearBuilt ?? null,
      status: input.status ?? "active",
    },
    include: {
      company: { select: { name: true, code: true } },
      _count: { select: { employeeVessels: true } },
    },
  });
  return mapVessel(row);
}

export async function updateVessel(
  id: string,
  input: Partial<{
    companyId: string;
    name: string;
    imoNumber: string | null;
    flag: string | null;
    vesselType: string | null;
    callSign: string | null;
    grossTonnage: number | null;
    yearBuilt: number | null;
    status: EntityStatus;
  }>,
) {
  const row = await prisma.vessel.update({
    where: { id },
    data: {
      ...(input.companyId != null ? { companyId: input.companyId } : {}),
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.imoNumber !== undefined ? { imoNumber: input.imoNumber?.trim() || null } : {}),
      ...(input.flag !== undefined ? { flag: input.flag?.trim() || null } : {}),
      ...(input.vesselType !== undefined ? { vesselType: input.vesselType?.trim() || null } : {}),
      ...(input.callSign !== undefined ? { callSign: input.callSign?.trim() || null } : {}),
      ...(input.grossTonnage !== undefined ? { grossTonnage: input.grossTonnage } : {}),
      ...(input.yearBuilt !== undefined ? { yearBuilt: input.yearBuilt } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
    include: {
      company: { select: { name: true, code: true } },
      _count: { select: { employeeVessels: true } },
    },
  });
  return mapVessel(row);
}

export async function setVesselStatus(id: string, status: EntityStatus) {
  return updateVessel(id, { status });
}

export async function deleteVessel(id: string) {
  await prisma.vessel.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function listVesselsForCompanyIds(companyIds: string[], activeOnly = true) {
  return prisma.vessel.findMany({
    where: {
      companyId: { in: companyIds },
      ...notDeleted,
      ...(activeOnly ? { status: "active" } : {}),
    },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      companyId: true,
      status: true,
      company: { select: { name: true, code: true } },
    },
  });
}
