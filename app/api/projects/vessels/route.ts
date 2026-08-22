import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUserId } from "@/lib/auth/session";
import {
  buildUserScope,
  resolveScopedVesselIds,
  vesselScopeWhere,
} from "@/lib/rbac/scopeRules";
import { requireProjectsApiAccess } from "@/lib/projects/projectScope";
import { notDeleted, paginatedResult, parsePagination } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Assigned vessels only — for Job Creations / new tender project. */
export async function GET(request: Request) {
  const denied = await requireProjectsApiAccess("page.office.projects.new");
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await buildUserScope(userId);
  const vesselIds = await resolveScopedVesselIds(scope);
  if (vesselIds !== undefined && vesselIds.length === 0) {
    return NextResponse.json(paginatedResult([], 0, 1, 50));
  }

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = searchParams.get("search")?.trim();

  const where: Prisma.VesselWhereInput = {
    ...notDeleted,
    status: "active",
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
      select: {
        id: true,
        code: true,
        name: true,
        imoNumber: true,
        yearBuilt: true,
        vesselType: true,
        company: { select: { name: true, code: true } },
      },
    }),
  ]);

  return NextResponse.json(paginatedResult(vessels, total, page, limit));
}
