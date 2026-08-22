import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { importSeaValvesForProject } from "@/lib/db/superintendent/seaValves";
import { parseSeaValveRows } from "@/lib/superintendent/seaValves";
import { parseSeaValveImportWorkbook } from "@/lib/superintendent/seaValvesExcel";

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

  const rows = await parseSeaValveImportWorkbook(await file.arrayBuffer());
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No sea valve rows found. Use the template: Group, Specification / type, and Overhaul location (in_situ or workshop) are required. Photos are not imported.",
      },
      { status: 400 },
    );
  }

  let currentValves;
  const rawCurrent = formData.get("valves");
  if (typeof rawCurrent === "string" && rawCurrent.trim()) {
    try {
      currentValves = parseSeaValveRows(JSON.parse(rawCurrent) as unknown);
    } catch {
      currentValves = undefined;
    }
  }

  try {
    const result = await importSeaValvesForProject({
      dryDockProjectId: id,
      incoming: rows,
      currentValves,
    });
    return NextResponse.json({
      imported: result.imported,
      skipped: result.skipped,
      valves: result.valves,
      submission: result.submission,
      message:
        result.imported === 0 && result.skipped > 0
          ? `No new valves imported. ${result.skipped} duplicate row(s) skipped.`
          : `Imported ${result.imported} valve(s)${result.skipped ? `, skipped ${result.skipped} duplicate(s)` : ""}.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
