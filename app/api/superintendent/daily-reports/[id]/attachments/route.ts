import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import {
  DAILY_REPORT_MAX_DOCUMENTS_PER_POINT,
  DAILY_REPORT_MAX_IMAGES_PER_POINT,
  DAILY_REPORT_MAX_IMAGES_PER_SECTION,
  isDailyReportSectionKey,
} from "@/lib/superintendent/dailyReportSections";
import { prisma } from "@/lib/prisma";
import { convertToBrowserJpeg } from "@/lib/superintendent/serverImagePreview";
import {
  convertReportDocumentToPdf,
  isConvertibleReportDocument,
} from "@/lib/superintendent/serverDocumentPreview";

export const dynamic = "force-dynamic";

function isImageUpload(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|jfif|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(file.name)
  );
}

type RouteCtx = { params: Promise<{ id: string }> };

async function loadReport(reportId: string) {
  return prisma.ddDailyReport.findFirst({
    where: { id: reportId, ...notDeleted },
    select: { id: true, dryDockProjectId: true },
  });
}

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId } = await ctx.params;
  const report = await loadReport(reportId);
  if (!report) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(request.url);
  const sectionKey = searchParams.get("sectionKey")?.trim();
  const pointId = searchParams.get("pointId")?.trim();

  if (sectionKey && !isDailyReportSectionKey(sectionKey)) {
    return NextResponse.json({ error: "Invalid sectionKey" }, { status: 400 });
  }

  const attachments = await prisma.ddDailyReportAttachment.findMany({
    where: {
      dailyReportId: reportId,
      ...(sectionKey ? { sectionKey } : {}),
      ...(pointId ? { pointId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ attachments });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId } = await ctx.params;
  const report = await loadReport(reportId);
  if (!report) return NextResponse.json({ error: "Daily report not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return access.response;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const sectionKey = String(formData.get("sectionKey") ?? "").trim();
  if (!sectionKey || !isDailyReportSectionKey(sectionKey)) {
    return NextResponse.json({ error: "sectionKey is required" }, { status: 400 });
  }

  const pointIdRaw = formData.get("pointId");
  const pointId =
    typeof pointIdRaw === "string" && pointIdRaw.trim() ? pointIdRaw.trim() : null;

  if (pointId) {
    const pointAttachments = await prisma.ddDailyReportAttachment.findMany({
      where: { dailyReportId: reportId, pointId },
      select: { fileName: true, mimeType: true },
    });
    const imageUpload = isImageUpload(file);
    const sameKindCount = pointAttachments.filter((item) => {
      const existingIsImage =
        item.mimeType?.startsWith("image/") ||
        /\.(png|jpe?g|jfif|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(item.fileName);
      return existingIsImage === imageUpload;
    }).length;
    const pointLimit = imageUpload
      ? DAILY_REPORT_MAX_IMAGES_PER_POINT
      : DAILY_REPORT_MAX_DOCUMENTS_PER_POINT;
    if (sameKindCount >= pointLimit) {
      return NextResponse.json(
        {
          error: imageUpload
            ? `Maximum ${pointLimit} photos per point`
            : `Maximum ${pointLimit} report/reference files per point`,
        },
        { status: 400 },
      );
    }
  }

  const existingCount = await prisma.ddDailyReportAttachment.count({
    where: { dailyReportId: reportId, sectionKey },
  });
  if (existingCount >= DAILY_REPORT_MAX_IMAGES_PER_SECTION) {
    return NextResponse.json(
      { error: `Maximum ${DAILY_REPORT_MAX_IMAGES_PER_SECTION} attachments per section` },
      { status: 400 },
    );
  }

  const imageUpload = isImageUpload(file);
  const originalBytes = Buffer.from(await file.arrayBuffer());
  let bytes: Buffer<ArrayBufferLike> = originalBytes;
  let savedFileName = file.name;
  let savedMimeType = file.type || null;

  if (imageUpload) {
    try {
      bytes = await convertToBrowserJpeg(originalBytes, file.name, 2200);
      savedFileName = `${path.basename(file.name, path.extname(file.name)) || "photo"}.jpg`;
      savedMimeType = "image/jpeg";
    } catch (error) {
      console.error("Daily report photo conversion failed", error);
      return NextResponse.json(
        { error: "This photo format could not be processed. Please use JPG, PNG, or HEIC." },
        { status: 422 },
      );
    }
  } else {
    if (!isConvertibleReportDocument(file.name, file.type)) {
      return NextResponse.json(
        { error: "Only PDF, Word, and Excel report attachments are supported." },
        { status: 415 },
      );
    }
    try {
      bytes = await convertReportDocumentToPdf(originalBytes, file.name);
      savedFileName = `${path.basename(file.name, path.extname(file.name)) || "report"}.pdf`;
      savedMimeType = "application/pdf";
    } catch (error) {
      console.error("Daily report document conversion failed", error);
      return NextResponse.json(
        { error: "The report attachment could not be converted to PDF." },
        { status: 422 },
      );
    }
  }

  const safeName = savedFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "superintendent",
    "daily-reports",
    reportId,
  );
  await mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${safeName}`;
  const diskPath = path.join(dir, storedName);
  await writeFile(diskPath, bytes);

  const fileUrl = `/uploads/superintendent/daily-reports/${reportId}/${storedName}`;
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  const attachment = await prisma.ddDailyReportAttachment.create({
    data: {
      dailyReportId: reportId,
      sectionKey,
      pointId,
      fileName: savedFileName,
      fileUrl,
      mimeType: savedMimeType,
      fileSize: bytes.length,
      caption,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
