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
import { ddPurchaseOrderCreateSchema, parseBody } from "@/lib/superintendent/validation";
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

  const where: Prisma.DdPurchaseOrderWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
  };
  if (status) where.status = status as Prisma.EnumDdPoStatusFilter["equals"];

  const [total, purchaseOrders] = await Promise.all([
    prisma.ddPurchaseOrder.count({ where }),
    prisma.ddPurchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ orderedDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return NextResponse.json(paginatedResult(purchaseOrders, total, page, limit));
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddPurchaseOrderCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const purchaseOrder = await prisma.ddPurchaseOrder.create({ data: parsed.data });
  return NextResponse.json({ purchaseOrder }, { status: 201 });
}
