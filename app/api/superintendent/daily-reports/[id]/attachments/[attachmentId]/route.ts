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

  const { id: reportId, attachmentId } = await ctx.params;

  const attachment = await prisma.ddDailyReportAttachment.findFirst({
    where: { id: attachmentId, dailyReportId: reportId },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const report = await prisma.ddDailyReport.findFirst({
    where: { id: reportId, ...notDeleted },
    select: { dryDockProjectId: true },
  });
  if (!report) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return access.response;

  await prisma.ddDailyReportAttachment.delete({ where: { id: attachmentId } });

  if (attachment.fileUrl.startsWith("/uploads/")) {
    const diskPath = path.join(process.cwd(), "public", attachment.fileUrl);
    await unlink(diskPath).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
