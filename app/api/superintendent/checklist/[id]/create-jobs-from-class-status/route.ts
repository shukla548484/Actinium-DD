import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";
import { prisma } from "@/lib/prisma";
import {
  allClassStatusRows,
  buildJobDescriptionFromClassRow,
  classStatusLineTag,
  parseStoredClassStatusAnalysis,
  type ClassStatusAnalysis,
  type ClassStatusTableRow,
} from "@/lib/superintendent/classStatusAnalysis";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function rowKind(
  analysis: ClassStatusAnalysis,
  rowId: string,
): "Class" | "COC" | "Class other" {
  if (analysis.cocs.some((r) => r.id === rowId)) return "COC";
  if (analysis.otherItems.some((r) => r.id === rowId)) return "Class other";
  return "Class";
}

function patchCreatedJobId(
  rows: ClassStatusTableRow[],
  id: string,
  jobId: string,
): ClassStatusTableRow[] {
  return rows.map((r) => (r.id === id ? { ...r, createdJobId: jobId, attend: true } : r));
}

/**
 * POST — create DdJob rows for ticked (or explicitly selected) class-status lines.
 * Body: { lineIds?: string[] } — if omitted, all rows with attend=true are used.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const item = await prisma.ddChecklistItem.findFirst({
    where: { id, ...notDeleted },
    select: {
      id: true,
      dryDockProjectId: true,
      classStatusAnalysis: true,
    },
  });
  if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(item.dryDockProjectId);
  if (!access.ok) return access.response;

  const analysis = parseStoredClassStatusAnalysis(item.classStatusAnalysis);
  if (!analysis) {
    return NextResponse.json(
      { error: "Analyze a Class Status Report before creating jobs." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { lineIds?: string[] };
  const allRows = allClassStatusRows(analysis);
  const selectedIds = new Set(
    Array.isArray(body.lineIds) && body.lineIds.length > 0
      ? body.lineIds
      : allRows.filter((r) => r.attend).map((r) => r.id),
  );

  if (selectedIds.size === 0) {
    return NextResponse.json(
      { error: "Tick at least one item to attend before creating jobs." },
      { status: 400 },
    );
  }

  const existingJobs = await prisma.ddJob.findMany({
    where: {
      dryDockProjectId: item.dryDockProjectId,
      ...notDeleted,
      description: { contains: "classStatusLineId=" },
    },
    select: { id: true, description: true },
  });

  function findExistingJobId(lineId: string): string | null {
    const tag = classStatusLineTag(lineId);
    const hit = existingJobs.find((j) => j.description?.includes(tag));
    return hit?.id ?? null;
  }

  let next = analysis;
  const created: Array<{ lineId: string; jobId: string; title: string; skipped: boolean }> = [];

  for (const row of allRows) {
    if (!selectedIds.has(row.id)) continue;

    const existingId = row.createdJobId || findExistingJobId(row.id);
    if (existingId) {
      const kind = rowKind(next, row.id);
      if (kind === "COC") {
        next = { ...next, cocs: patchCreatedJobId(next.cocs, row.id, existingId) };
      } else if (kind === "Class other") {
        next = {
          ...next,
          otherItems: patchCreatedJobId(next.otherItems, row.id, existingId),
        };
      } else {
        next = { ...next, jobs: patchCreatedJobId(next.jobs, row.id, existingId) };
      }
      created.push({
        lineId: row.id,
        jobId: existingId,
        title: row.title,
        skipped: true,
      });
      continue;
    }

    const kind = rowKind(next, row.id);
    const category = kind === "COC" ? "COC" : kind === "Class other" ? "Class" : "Class";
    const priority = kind === "COC" ? "high" : "medium";

    const job = await prisma.ddJob.create({
      data: {
        dryDockProjectId: item.dryDockProjectId,
        title: row.title.slice(0, 500),
        category,
        jobCode: row.ref,
        description: buildJobDescriptionFromClassRow(row, kind, next.sourceFileName),
        priority,
        status: "planned",
      },
    });

    if (kind === "COC") {
      next = { ...next, cocs: patchCreatedJobId(next.cocs, row.id, job.id) };
    } else if (kind === "Class other") {
      next = {
        ...next,
        otherItems: patchCreatedJobId(next.otherItems, row.id, job.id),
      };
    } else {
      next = { ...next, jobs: patchCreatedJobId(next.jobs, row.id, job.id) };
    }

    created.push({
      lineId: row.id,
      jobId: job.id,
      title: row.title,
      skipped: false,
    });
  }

  const newlyCreated = created.filter((c) => !c.skipped).length;
  const markComplete =
    newlyCreated > 0 ||
    created.some((c) => c.skipped) ||
    next.capCertification.ownersRequireCap !== null;

  await prisma.ddChecklistItem.update({
    where: { id },
    data: {
      classStatusAnalysis: next as unknown as Prisma.InputJsonValue,
      ...(markComplete && next.capCertification.ownersRequireCap !== null
        ? { isCompleted: true, completedAt: new Date() }
        : {}),
      notes: `Created ${newlyCreated} dry-dock job(s) from Class Status Report (${created.filter((c) => c.skipped).length} already existed).`,
    },
  });

  if (newlyCreated > 0) {
    await syncDryDockProjectProgress(item.dryDockProjectId);
  }

  return NextResponse.json({
    analysis: next,
    created,
    createdCount: newlyCreated,
    skippedCount: created.filter((c) => c.skipped).length,
    dryDockProjectId: item.dryDockProjectId,
  });
}
