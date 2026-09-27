import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  convertReportDocumentToPdf,
  getPdfPageCount,
  isConvertibleReportDocument,
  renderPdfPage,
} from "@/lib/superintendent/serverDocumentPreview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const TOKEN_PATTERN = /^[a-f0-9-]{36}$/;
const cacheRoot = () =>
  path.join(process.cwd(), ".next", "cache", "daily-report-draft-documents");

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a valid report attachment" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Report attachment must be 25 MB or smaller" }, { status: 400 });
  }
  if (!isConvertibleReportDocument(file.name, file.type)) {
    return NextResponse.json(
      { error: "Only PDF, Word, and Excel report attachments are supported" },
      { status: 415 },
    );
  }

  try {
    const token = randomUUID();
    const outputDir = path.join(cacheRoot(), token);
    await mkdir(outputDir, { recursive: true });
    const pdf = await convertReportDocumentToPdf(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    );
    const pdfPath = path.join(outputDir, "attachment.pdf");
    await writeFile(pdfPath, pdf);
    const pages = await getPdfPageCount(pdfPath);
    await writeFile(path.join(outputDir, "pages.txt"), String(pages));
    return NextResponse.json({ token, pages });
  } catch (error) {
    console.error("Draft report attachment conversion failed", error);
    return NextResponse.json(
      { error: "The report attachment could not be converted to PDF" },
      { status: 422 },
    );
  }
}

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const page = Number(searchParams.get("page") ?? 0);
  if (!TOKEN_PATTERN.test(token) || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid document preview request" }, { status: 400 });
  }

  try {
    const outputDir = path.join(cacheRoot(), token);
    const pages = Number(await readFile(path.join(outputDir, "pages.txt"), "utf8"));
    if (!Number.isInteger(pages) || page > pages) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    const pdfPath = path.join(outputDir, "attachment.pdf");
    const pagePath = path.join(outputDir, `page-${page}.png`);
    try {
      await stat(pagePath);
    } catch {
      await renderPdfPage(pdfPath, page, path.join(outputDir, `page-${page}`));
    }

    const png = await readFile(pagePath);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(png.length),
      },
    });
  } catch (error) {
    console.error("Draft report attachment page failed", error);
    return NextResponse.json({ error: "Document preview page is unavailable" }, { status: 404 });
  }
}
