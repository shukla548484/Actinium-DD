import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted, paginatedResult, parsePagination } from "@/lib/superintendent/helpers";
import { getScopedVesselIds, vesselScopeWhere } from "@/lib/superintendent/scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = searchParams.get("search") ?? undefined;
  const vesselIds = await getScopedVesselIds();

  const where: Prisma.VesselWhereInput = {
    ...notDeleted,
    ...vesselScopeWhere(vesselIds),
  };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { imoNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, vessels] = await Promise.all([
    prisma.vessel.count({ where }),
    prisma.vessel.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        company: { select: { name: true, code: true } },
        technicalProfile: true,
        _count: { select: { dryDockProjects: true } },
      },
    }),
  ]);

  return NextResponse.json(paginatedResult(vessels, total, page, limit));
}
