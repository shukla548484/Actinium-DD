import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

async function loadScopedAttachment(reportId: string, attachmentId: string) {
  const attachment = await prisma.ddDailyReportAttachment.findFirst({
    where: { id: attachmentId, dailyReportId: reportId },
  });
  if (!attachment) return { error: NextResponse.json({ error: "Attachment not found" }, { status: 404 }) };

  const report = await prisma.ddDailyReport.findFirst({
    where: { id: reportId, ...notDeleted },
    select: { dryDockProjectId: true },
  });
  if (!report) return { error: NextResponse.json({ error: "Daily report not found" }, { status: 404 }) };

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return { error: access.response };

  return { attachment };
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId, attachmentId } = await ctx.params;
  const loaded = await loadScopedAttachment(reportId, attachmentId);
  if ("error" in loaded) return loaded.error;

  const body = (await request.json().catch(() => null)) as { caption?: string | null } | null;
  if (!body || !("caption" in body)) {
    return NextResponse.json({ error: "caption is required" }, { status: 400 });
  }

  const caption =
    body.caption == null ? null : String(body.caption).trim() || null;

  const attachment = await prisma.ddDailyReportAttachment.update({
    where: { id: attachmentId },
    data: { caption },
  });

  return NextResponse.json({ attachment });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId, attachmentId } = await ctx.params;
  const loaded = await loadScopedAttachment(reportId, attachmentId);
  if ("error" in loaded) return loaded.error;
  const { attachment } = loaded;

  await prisma.ddDailyReportAttachment.delete({ where: { id: attachmentId } });

  if (attachment.fileUrl.startsWith("/uploads/")) {
    const diskPath = path.join(process.cwd(), "public", attachment.fileUrl);
    await unlink(diskPath).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
