import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { importMasterSpecRows } from "@/lib/db/masterCatalog";
import { parseSpecImportRows, readWorkbookRows } from "@/lib/tender/specExcel";
import { STANDARD_DOCKING_CATEGORIES } from "@/lib/tender/categories";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const rows = readWorkbookRows(bytes);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Workbook is empty." }, { status: 400 });
  }

  const parsed = parseSpecImportRows(rows, STANDARD_DOCKING_CATEGORIES);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid spec rows found." }, { status: 400 });
  }

  const result = await importMasterSpecRows(parsed);
  return NextResponse.json(result);
}
