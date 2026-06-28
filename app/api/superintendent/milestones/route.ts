import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  findDryDockProject,
  notDeleted,
  paginatedResult,
  parsePagination,
} from "@/lib/superintendent/helpers";
import {
  buildChildEntityWhere,
  guardChildListAccess,
} from "@/lib/superintendent/childRouteScope";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ddMilestoneCreateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;

  const guard = await guardChildListAccess(dryDockProjectId, page, limit);
  if (!guard.ok) return NextResponse.json(guard.response);

  const where: Prisma.DdMilestoneWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
  };

  const [total, milestones] = await Promise.all([
    prisma.ddMilestone.count({ where }),
    prisma.ddMilestone.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { plannedDate: "asc" }],
    }),
  ]);

  return NextResponse.json(paginatedResult(milestones, total, page, limit));
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddMilestoneCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const milestone = await prisma.ddMilestone.create({ data: parsed.data });
  return NextResponse.json({ milestone }, { status: 201 });
}
