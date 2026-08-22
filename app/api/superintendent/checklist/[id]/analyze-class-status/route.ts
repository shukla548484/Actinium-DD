import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";
import {
  analyzeClassStatusReport,
  parseStoredClassStatusAnalysis,
} from "@/lib/superintendent/classStatusAnalysis";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteCtx = { params: Promise<{ id: string }> };

function resolveUploadPath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null;
  return path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
}

/** GET — return stored class status analysis for this checklist item. */
export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const item = await prisma.ddChecklistItem.findFirst({
    where: { id, ...notDeleted },
    select: {
      id: true,
      dryDockProjectId: true,
      title: true,
      classStatusAnalysis: true,
    },
  });
  if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(item.dryDockProjectId);
  if (!access.ok) return access.response;

  return NextResponse.json({
    analysis: parseStoredClassStatusAnalysis(item.classStatusAnalysis),
  });
}

/**
 * POST — OpenAI reads the Class Status Report PDF online; local extract is compared; lite tables returned.
 * Body: { attachmentId?: string }
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const item = await prisma.ddChecklistItem.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, dryDockProjectId: true },
  });
  if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(item.dryDockProjectId);
  if (!access.ok) return access.response;

  const project = await prisma.dryDockProject.findFirst({
    where: { id: item.dryDockProjectId, ...notDeleted },
    select: { plannedStart: true, plannedEnd: true },
  });

  const body = (await request.json().catch(() => ({}))) as { attachmentId?: string };
  const attachment = body.attachmentId
    ? await prisma.ddChecklistAttachment.findFirst({
        where: { id: body.attachmentId, checklistItemId: id },
      })
    : await prisma.ddChecklistAttachment.findFirst({
        where: { checklistItemId: id },
        orderBy: { createdAt: "desc" },
      });

  if (!attachment) {
    return NextResponse.json(
      { error: "Upload a Class Status Report before running analysis." },
      { status: 400 },
    );
  }

  const diskPath = resolveUploadPath(attachment.fileUrl);
  if (!diskPath) {
    return NextResponse.json(
      { error: "Attachment is not available on the local upload store." },
      { status: 400 },
    );
  }

  try {
    const buffer = await readFile(diskPath);
    const analysis = await analyzeClassStatusReport({
      buffer,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      attachmentId: attachment.id,
      dryDockStart: project?.plannedStart?.toISOString().slice(0, 10) ?? null,
      dryDockEnd: project?.plannedEnd?.toISOString().slice(0, 10) ?? null,
    });

    await prisma.ddChecklistItem.update({
      where: { id },
      data: {
        classStatusAnalysis: analysis as unknown as Prisma.InputJsonValue,
        notes:
          "Class Status Report uploaded and analyzed. Review findings, tick items, and create jobs as needed.",
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * PATCH — save user ticks / CAP confirmations.
 * Does not mark checklist complete (completion happens after job creation or explicit mark).
 * Body: { analysis, markComplete?: boolean }
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const item = await prisma.ddChecklistItem.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, dryDockProjectId: true, classStatusAnalysis: true },
  });
  if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(item.dryDockProjectId);
  if (!access.ok) return access.response;

  const body = (await request.json()) as {
    analysis?: Record<string, unknown> & { version?: number; capCertification?: { ownersRequireCap: boolean | null } };
    markComplete?: boolean;
  };
  const version = Number(body.analysis?.version);
  if (!body.analysis || (version !== 2 && version !== 3)) {
    return NextResponse.json(
      { error: "Invalid analysis payload (expected version 2 or 3)" },
      { status: 400 },
    );
  }

  const markComplete = Boolean(body.markComplete);
  if (markComplete && body.analysis.capCertification?.ownersRequireCap === null) {
    return NextResponse.json(
      {
        error:
          "Confirm whether the owners require CAP certification (Yes or No) before marking complete.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.ddChecklistItem.update({
    where: { id },
    data: {
      classStatusAnalysis: body.analysis as unknown as Prisma.InputJsonValue,
      ...(markComplete ? { isCompleted: true, completedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({
    analysis: parseStoredClassStatusAnalysis(updated.classStatusAnalysis),
  });
}
