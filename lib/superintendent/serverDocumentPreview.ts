import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OFFICE_EXTENSIONS = new Set([".doc", ".docx", ".xls", ".xlsx"]);
const PDF_SIGNATURE = Buffer.from("%PDF-");

export function isConvertibleReportDocument(fileName: string, mimeType?: string | null): boolean {
  const extension = path.extname(fileName).toLowerCase();
  return (
    extension === ".pdf" ||
    OFFICE_EXTENSIONS.has(extension) ||
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

async function runSoffice(inputPath: string, outputDir: string) {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    "soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ].filter((value): value is string => Boolean(value));

  let lastError: unknown = null;
  for (const command of candidates) {
    try {
      await execFileAsync(
        command,
        ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
        { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("LibreOffice is unavailable");
}

export async function convertReportDocumentToPdf(
  bytes: Buffer,
  fileName: string,
): Promise<Buffer> {
  if (bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) return bytes;

  const extension = path.extname(fileName).toLowerCase();
  if (!OFFICE_EXTENSIONS.has(extension)) {
    throw new Error("Only PDF, Word, and Excel report attachments are supported");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "actinium-report-document-"));
  const safeBase = (path.basename(fileName, extension) || "attachment").replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
  const inputPath = path.join(tempDir, `${safeBase}${extension}`);

  try {
    await writeFile(inputPath, bytes);
    await runSoffice(inputPath, tempDir);
    const generated = (await readdir(tempDir)).find(
      (entry) => path.extname(entry).toLowerCase() === ".pdf",
    );
    if (!generated) throw new Error("Document conversion did not produce a PDF");
    return await readFile(path.join(tempDir, generated));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync("pdfinfo", [pdfPath], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  const match = /^Pages:\s+(\d+)$/im.exec(stdout);
  const count = Number(match?.[1] ?? 0);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Could not determine PDF page count");
  }
  return count;
}

export async function renderPdfPage(
  pdfPath: string,
  page: number,
  outputPrefix: string,
): Promise<string> {
  await execFileAsync(
    "pdftoppm",
    [
      "-f",
      String(page),
      "-l",
      String(page),
      "-singlefile",
      "-png",
      "-r",
      "144",
      pdfPath,
      outputPrefix,
    ],
    { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
  );
  return `${outputPrefix}.png`;
}
