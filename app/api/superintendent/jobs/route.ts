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
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import { ddJobCreateSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const guard = await guardChildListAccess(dryDockProjectId, page, limit);
  if (!guard.ok) return NextResponse.json(guard.response);

  const where: Prisma.DdJobWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
  };

  if (status) where.status = status as Prisma.EnumDdJobStatusFilter["equals"];

  const [total, jobs] = await Promise.all([
    prisma.ddJob.count({ where }),
    prisma.ddJob.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json(paginatedResult(jobs, total, page, limit));
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddJobCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const job = await prisma.ddJob.create({ data: parsed.data });
  await syncDryDockProjectProgress(parsed.data.dryDockProjectId);
  return NextResponse.json({ job }, { status: 201 });
}
