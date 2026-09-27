import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import {
  convertReportDocumentToPdf,
  getPdfPageCount,
  isConvertibleReportDocument,
  renderPdfPage,
} from "@/lib/superintendent/serverDocumentPreview";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

async function loadAttachment(reportId: string, attachmentId: string) {
  const attachment = await prisma.ddDailyReportAttachment.findFirst({
    where: { id: attachmentId, dailyReportId: reportId },
    select: { fileName: true, fileUrl: true, mimeType: true },
  });
  if (!attachment) {
    return { response: NextResponse.json({ error: "Attachment not found" }, { status: 404 }) };
  }

  const report = await prisma.ddDailyReport.findFirst({
    where: { id: reportId, ...notDeleted },
    select: { dryDockProjectId: true },
  });
  if (!report) {
    return { response: NextResponse.json({ error: "Daily report not found" }, { status: 404 }) };
  }

  const access = await assertDryDockProjectInScope(report.dryDockProjectId);
  if (!access.ok) return { response: access.response };

  if (!isConvertibleReportDocument(attachment.fileName, attachment.mimeType)) {
    return {
      response: NextResponse.json(
        { error: "Only PDF, Word, and Excel attachments can be added as report pages" },
        { status: 415 },
      ),
    };
  }

  const expectedPrefix = `/uploads/superintendent/daily-reports/${reportId}/`;
  if (!attachment.fileUrl.startsWith(expectedPrefix)) {
    return { response: NextResponse.json({ error: "Attachment file is unavailable" }, { status: 404 }) };
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
    return { response: NextResponse.json({ error: "Invalid attachment path" }, { status: 400 }) };
  }

  return { attachment, diskPath };
}

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: reportId, attachmentId } = await ctx.params;
  const loaded = await loadAttachment(reportId, attachmentId);
  if ("response" in loaded) return loaded.response;

  try {
    const sourceStat = await stat(loaded.diskPath);
    const fingerprint = `${sourceStat.size}-${Math.trunc(sourceStat.mtimeMs)}`;
    const cacheDir = path.join(
      process.cwd(),
      ".next",
      "cache",
      "daily-report-document-pages",
      attachmentId,
      fingerprint,
    );
    const pdfPath = path.join(cacheDir, "attachment.pdf");
    const countPath = path.join(cacheDir, "pages.txt");
    await mkdir(cacheDir, { recursive: true });

    let pages: number;
    try {
      pages = Number(await readFile(countPath, "utf8"));
      if (!Number.isInteger(pages) || pages < 1) throw new Error("Invalid page cache");
    } catch {
      await rm(pdfPath, { force: true });
      const source = await readFile(loaded.diskPath);
      const pdf = await convertReportDocumentToPdf(source, loaded.attachment.fileName);
      await writeFile(pdfPath, pdf);
      pages = await getPdfPageCount(pdfPath);
      await writeFile(countPath, String(pages));
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("meta") === "1") {
      return NextResponse.json({ pages });
    }

    const page = Number(searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 1 || page > pages) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    const pagePath = path.join(cacheDir, `page-${page}.png`);
    try {
      await stat(pagePath);
    } catch {
      await renderPdfPage(pdfPath, page, path.join(cacheDir, `page-${page}`));
    }

    const png = await readFile(pagePath);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(png.length),
      },
    });
  } catch (error) {
    console.error("Daily report document page conversion failed", error);
    return NextResponse.json(
      { error: "The attached report could not be converted to PDF pages" },
      { status: 422 },
    );
  }
}
