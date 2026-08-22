import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";
import { parseStoredClassStatusAnalysis } from "@/lib/superintendent/classStatusAnalysis";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

function resolveUploadPath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null;
  return path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
}

/** DELETE — remove an uploaded checklist attachment (and clear analysis if it was the source). */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: checklistItemId, attachmentId } = await ctx.params;
  const item = await prisma.ddChecklistItem.findFirst({
    where: { id: checklistItemId, ...notDeleted },
    select: { id: true, dryDockProjectId: true, classStatusAnalysis: true },
  });
  if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(item.dryDockProjectId);
  if (!access.ok) return access.response;

  const attachment = await prisma.ddChecklistAttachment.findFirst({
    where: { id: attachmentId, checklistItemId },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const diskPath = resolveUploadPath(attachment.fileUrl);
  await prisma.ddChecklistAttachment.delete({ where: { id: attachment.id } });

  if (diskPath) {
    await unlink(diskPath).catch(() => undefined);
  }

  const analysis = parseStoredClassStatusAnalysis(item.classStatusAnalysis);
  let clearedAnalysis = false;
  if (analysis?.sourceAttachmentId === attachment.id) {
    await prisma.ddChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        classStatusAnalysis: null as unknown as Prisma.InputJsonValue,
        notes: "Class Status Report file removed. Upload and analyze again.",
        isCompleted: false,
        completedAt: null,
      },
    });
    clearedAnalysis = true;
  }

  return NextResponse.json({ ok: true, clearedAnalysis });
}
