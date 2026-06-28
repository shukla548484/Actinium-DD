import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSpecLine, getProject, listSpecLines } from "@/lib/db/index";
import { ensureProjectCategories } from "@/lib/db/categories";
import { parseSpecImportRows } from "@/lib/tender/specExcel";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await context.params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(bytes), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "Workbook has no sheets." }, { status: 400 });
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Sheet is empty." }, { status: 400 });
  }

  const existingLines = await listSpecLines(projectId);
  const categories = await ensureProjectCategories(projectId);
  const existingCodes = new Set(existingLines.map((l) => l.lineCode?.toLowerCase()));

  const parsed = parseSpecImportRows(rows, categories);
  const imported: string[] = [];
  const skipped: string[] = [];

  for (const row of parsed) {
    if (row.lineCode && existingCodes.has(row.lineCode.toLowerCase())) {
      skipped.push(row.lineCode);
      continue;
    }

    await createSpecLine({
      projectId,
      bucket: row.bucket,
      lineCode: row.lineCode,
      description: row.description,
      descriptionZh: row.descriptionZh,
      descriptionJa: row.descriptionJa,
      unit: row.unit,
      defaultQty: row.defaultQty,
      calcRule: row.calcRule,
      scopeDays: row.scopeDays,
      scopeAreaM2: row.scopeAreaM2,
      scopeNotes: row.scopeNotes,
      referenceUnitRate: row.referenceUnitRate,
      maxDiscountPct: row.maxDiscountPct,
      allowDiscount: row.allowDiscount,
      isOptional: row.isOptional,
    });

    imported.push(row.lineCode ?? row.description.slice(0, 30));
    if (row.lineCode) existingCodes.add(row.lineCode.toLowerCase());
  }

  return NextResponse.json({
    imported: imported.length,
    skipped: skipped.length,
    importedLines: imported,
    skippedLines: skipped,
  });
}
