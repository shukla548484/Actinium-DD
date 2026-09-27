import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { convertToBrowserJpeg } from "@/lib/superintendent/serverImagePreview";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId, attachmentId } = await ctx.params;
  const attachment = await prisma.ddDailyReportAttachment.findFirst({
    where: { id: attachmentId, dailyReportId: reportId },
    select: { fileName: true, fileUrl: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const report = await prisma.ddDailyReport.findFirst({
    where: { id: reportId, ...notDeleted },
    select: { dryDockProjectId: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Daily report not found" }, { status: 404 });
  }

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return access.response;

  const expectedPrefix = `/uploads/superintendent/daily-reports/${reportId}/`;
  if (!attachment.fileUrl.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Attachment file is unavailable" }, { status: 404 });
  }

  const uploadRoot = path.resolve(
    process.cwd(),
    "public",
    "uploads",
    "superintendent",
    "daily-reports",
    reportId,
  );
  const diskPath = path.resolve(process.cwd(), "public", attachment.fileUrl.replace(/^\/+/, ""));
  if (!diskPath.startsWith(`${uploadRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid attachment path" }, { status: 400 });
  }

  try {
    const jpeg = await convertToBrowserJpeg(
      await readFile(diskPath),
      attachment.fileName,
      1800,
    );
    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(jpeg.length),
      },
    });
  } catch (error) {
    console.error("Stored daily report image preview failed", error);
    return NextResponse.json({ error: "Image preview is unavailable" }, { status: 422 });
  }
}
