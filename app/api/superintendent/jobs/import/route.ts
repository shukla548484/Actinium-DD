import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { readJobImportWorkbook } from "@/lib/superintendent/importJobs";
import {
  assertDryDockProjectInScope,
  getScopedVesselIds,
} from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const dryDockProjectId = (formData.get("dryDockProjectId") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!dryDockProjectId) {
    return NextResponse.json({ error: "dryDockProjectId is required" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const access = await assertDryDockProjectInScope(dryDockProjectId);
  if (!access.ok) return access.response;

  const vesselIds = await getScopedVesselIds();
  if (vesselIds?.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
  });
  if (!project) {
    return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });
  }

  const rows = readJobImportWorkbook(await file.arrayBuffer());
  if (rows.length === 0) {
    return NextResponse.json({ error: "No job rows found in spreadsheet" }, { status: 400 });
  }

  const maxSort = await prisma.ddJob.aggregate({
    where: { dryDockProjectId, ...notDeleted },
    _max: { sortOrder: true },
  });
  let sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  const created = [];
  for (const row of rows) {
    const job = await prisma.ddJob.create({
      data: {
        dryDockProjectId,
        title: row.title,
        category: row.category,
        jobCode: row.jobCode,
        description: row.description,
        priority: row.priority,
        status: row.status,
        budgetAmount: row.budgetAmount,
        sortOrder: sortOrder++,
      },
    });
    created.push(job.id);
  }

  return NextResponse.json({
    imported: created.length,
    jobIds: created,
  });
}
