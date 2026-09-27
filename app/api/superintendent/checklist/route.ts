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
import { ddChecklistItemCreateSchema, parseBody } from "@/lib/superintendent/validation";
import {
  hasCompletedClassStatusUpload,
  isClassStatusChecklistTitle,
} from "@/lib/superintendent/classStatusAnalysis";
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

  const where: Prisma.DdChecklistItemWhereInput = {
    ...notDeleted,
    ...buildChildEntityWhere(dryDockProjectId, guard.projectFilter),
  };

  const scopedToOneProject = Boolean(dryDockProjectId);
  const orderBy = scopedToOneProject
    ? ([{ sortOrder: "asc" }, { createdAt: "desc" }] as const)
    : ([
        { dryDockProject: { name: "asc" } },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ] as const);

  const [total, completedCount, checklistItems] = await Promise.all([
    prisma.ddChecklistItem.count({ where }),
    prisma.ddChecklistItem.count({ where: { ...where, isCompleted: true } }),
    prisma.ddChecklistItem.findMany({
      where,
      skip,
      take: limit,
      orderBy: [...orderBy],
      include: {
        dryDockProject: { select: { id: true, name: true, referenceCode: true } },
      },
    }),
  ]);

  const idsToSync = checklistItems
    .filter(
      (item) =>
        !item.isCompleted &&
        isClassStatusChecklistTitle(item.title) &&
        hasCompletedClassStatusUpload(item.classStatusAnalysis),
    )
    .map((item) => item.id);

  let syncedCompletedCount = completedCount;
  if (idsToSync.length > 0) {
    const now = new Date();
    await prisma.ddChecklistItem.updateMany({
      where: { id: { in: idsToSync } },
      data: { isCompleted: true, completedAt: now },
    });
    for (const item of checklistItems) {
      if (idsToSync.includes(item.id)) {
        item.isCompleted = true;
        item.completedAt = now;
      }
    }
    syncedCompletedCount += idsToSync.length;
  }

  const items = checklistItems.map(({ dryDockProject, ...item }) => ({
    ...item,
    projectName: dryDockProject.name,
    projectReferenceCode: dryDockProject.referenceCode,
  }));

  return NextResponse.json({
    ...paginatedResult(items, total, page, limit),
    completedCount: syncedCompletedCount,
  });
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddChecklistItemCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const checklistItem = await prisma.ddChecklistItem.create({ data: parsed.data });
  return NextResponse.json({ checklistItem }, { status: 201 });
}
