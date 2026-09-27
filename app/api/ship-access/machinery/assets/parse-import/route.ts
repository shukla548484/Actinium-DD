import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { parseMachineryRegisterWorkbook } from "@/lib/machinery/machineryRegisterExcel";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXCEL_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

export async function POST(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const form = await request.formData();
    const vesselId =
      (typeof form.get("vesselId") === "string" ? (form.get("vesselId") as string) : null) ??
      (await getSelectedShipVesselId());
    if (!vesselId) {
      return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }
    if (file.type && !EXCEL_TYPES.has(file.type) && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json({ error: "Upload an Excel file (.xlsx)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseMachineryRegisterWorkbook(buffer);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No machinery rows found. Ensure the sheet has a 'Machinery name' column and at least one data row.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      rows,
      message: `Parsed ${rows.length} row(s). Review and confirm to register.`,
    });
  } catch (err) {
    console.error("[ship-access/machinery/assets/parse-import] POST failed", err);
    return NextResponse.json({ error: "Failed to parse Excel file" }, { status: 500 });
  }
}
