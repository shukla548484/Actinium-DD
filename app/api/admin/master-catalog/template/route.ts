import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { ensureMasterCatalogSeeded, listMasterSpecLines } from "@/lib/db/masterCatalog";
import { STANDARD_DOCKING_CATEGORIES } from "@/lib/tender/categories";
import { buildEmptySpecTemplateWorkbook, buildSpecTemplateWorkbook } from "@/lib/tender/specExcel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "current";
  const bucket = searchParams.get("bucket") ?? undefined;

  let buffer: Buffer;
  let filename: string;

  if (mode === "empty") {
    buffer = buildEmptySpecTemplateWorkbook(STANDARD_DOCKING_CATEGORIES);
    filename = "master-spec-template.xlsx";
  } else {
    await ensureMasterCatalogSeeded();
    const lines = await listMasterSpecLines({ bucket, activeOnly: false });
    buffer = buildSpecTemplateWorkbook(lines, STANDARD_DOCKING_CATEGORIES);
    filename = bucket ? `master-spec-${bucket}.xlsx` : "master-spec-catalog.xlsx";
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
