import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: jobId, attachmentId } = await ctx.params;

  const attachment = await prisma.ddJobAttachment.findFirst({
    where: { id: attachmentId, jobId },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const job = await prisma.ddJob.findFirst({
    where: { id: jobId, ...notDeleted },
    select: { dryDockProjectId: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(job.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddJobAttachment.delete({ where: { id: attachmentId } });

  if (attachment.fileUrl.startsWith("/uploads/")) {
    const diskPath = path.join(process.cwd(), "public", attachment.fileUrl);
    await unlink(diskPath).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
