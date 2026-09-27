import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  machineryRegisterParseHttpError,
  parseMachineryRegisterWorkbook,
} from "@/lib/machinery/machineryRegisterExcel";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXCEL_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

async function resolveVesselId(form: FormData, request: Request) {
  const { searchParams } = new URL(request.url);
  let dryDockProjectId = searchParams.get("dryDockProjectId");
  let vesselId = searchParams.get("vesselId");
  const p = form.get("dryDockProjectId");
  const v = form.get("vesselId");
  if (typeof p === "string" && p) dryDockProjectId = p;
  if (typeof v === "string" && v) vesselId = v;

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId: access.vesselId };
  }
  if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return { error: access.response as NextResponse };
    return { vesselId };
  }
  return {
    error: NextResponse.json(
      { error: "dryDockProjectId or vesselId required" },
      { status: 400 },
    ),
  };
}

export async function POST(request: Request) {
  try {
    const denied = await requireSuperintendentApiAccess();
    if (denied) return denied;

    const form = await request.formData();
    const resolved = await resolveVesselId(form, request);
    if ("error" in resolved) return resolved.error;

    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      return NextResponse.json(
        {
          error:
            "Legacy .xls is not supported. Download the template and save/upload as .xlsx.",
        },
        { status: 400 },
      );
    }
    if (!name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }
    if (file.type && !EXCEL_TYPES.has(file.type) && !name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseMachineryRegisterWorkbook(buffer);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No machinery rows found. Add at least one row with Machinery name (row 5+). The example row is ignored — delete it or add your own rows below it.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      rows,
      vesselId: resolved.vesselId,
      message: `Parsed ${rows.length} row(s). Review and confirm to register.`,
    });
  } catch (err) {
    const mapped = machineryRegisterParseHttpError(err);
    if (mapped.status >= 500) {
      console.error("[superintendent/machinery-assets/parse-import] POST failed", err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
