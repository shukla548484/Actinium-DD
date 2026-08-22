import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { importProjectDefects } from "@/lib/db/superintendent/projectDefects";
import { parseDefectImportWorkbook } from "@/lib/superintendent/defectsExcel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

const EXCEL_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No Excel file uploaded." }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
  }
  if (file.type && !EXCEL_TYPES.has(file.type) && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
  }

  const rows = await parseDefectImportWorkbook(await file.arrayBuffer());
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No defect rows found. Use the template: Department and Defect details are required. Photos are not imported.",
      },
      { status: 400 },
    );
  }

  const result = await importProjectDefects({
    dryDockProjectId: id,
    rows,
    fileName: file.name,
    createdByUserId: await getSessionUserId(),
  });

  return NextResponse.json({
    imported: result.imported,
    skipped: result.skipped,
    defects: result.defects,
    submission: result.submission,
    message:
      result.imported === 0 && result.skipped > 0
        ? `No new defects imported. ${result.skipped} duplicate row(s) skipped.`
        : `Imported ${result.imported} defect(s)${result.skipped ? `, skipped ${result.skipped} duplicate(s)` : ""}.`,
  });
}
