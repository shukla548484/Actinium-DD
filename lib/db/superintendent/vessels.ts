import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveVesselScope } from "@/lib/db/superintendent/dashboard";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type {
  ListQuery,
  SuperintendentVesselDto,
  VesselOverviewDto,
  VesselTechnicalProfileDto,
} from "@/lib/superintendent/types";

function mapTechnicalProfile(row: {
  id: string;
  vesselId: string;
  classNotation: string | null;
  mainEngine: string | null;
  auxiliaryEngine: string | null;
  boilerInfo: string | null;
  defectSummary: string | null;
  pmsSummary: string | null;
  sparesSummary: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VesselTechnicalProfileDto {
  return {
    id: row.id,
    vesselId: row.vesselId,
    classNotation: row.classNotation,
    mainEngine: row.mainEngine,
    auxiliaryEngine: row.auxiliaryEngine,
    boilerInfo: row.boilerInfo,
    defectSummary: row.defectSummary,
    pmsSummary: row.pmsSummary,
    sparesSummary: row.sparesSummary,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapVessel(
  row: Prisma.VesselGetPayload<{
    include: { _count: { select: { dryDockProjects: true } } };
  }>,
): SuperintendentVesselDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    imoNumber: row.imoNumber,
    flag: row.flag,
    vesselType: row.vesselType,
    status: row.status,
    nextDryDockDue: row.nextDryDockDue?.toISOString() ?? null,
    lastDryDockDate: row.lastDryDockDate?.toISOString() ?? null,
    classSociety: row.classSociety,
    readinessScore: row.readinessScore,
    dryDockProjectCount: row._count?.dryDockProjects,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssignedVessels(query: ListQuery = {}) {
  const { page, limit, skip } = parsePageLimit(query);
  const vesselIds = await resolveVesselScope(query);

  if (query.employeeId && vesselIds && vesselIds.length === 0) {
    return { vessels: [], total: 0, page, limit, totalPages: 0 };
  }

  const where: Prisma.VesselWhereInput = { ...notDeleted };
  if (vesselIds?.length) {
    where.id = { in: vesselIds };
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
      { imoNumber: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.status && query.status !== "all") {
    where.status = query.status as Prisma.VesselWhereInput["status"];
  }

  const [total, rows] = await Promise.all([
    prisma.vessel.count({ where }),
    prisma.vessel.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            dryDockProjects: { where: notDeleted },
          },
        },
      },
    }),
  ]);

  return {
    vessels: rows.map(mapVessel),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export async function getVesselOverview(id: string): Promise<VesselOverviewDto | null> {
  const row = await prisma.vessel.findFirst({
    where: { id, ...notDeleted },
    include: {
      technicalProfile: true,
      _count: {
        select: {
          dryDockProjects: { where: notDeleted },
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...mapVessel(row),
    technicalProfile: row.technicalProfile ? mapTechnicalProfile(row.technicalProfile) : null,
    projectCount: row._count.dryDockProjects,
  };
}
