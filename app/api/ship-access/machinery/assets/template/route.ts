import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import {
  buildMachineryRegisterTemplateWorkbook,
  excelAttachmentResponse,
} from "@/lib/machinery/machineryRegisterExcel";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId") ?? (await getSelectedShipVesselId());
    if (!vesselId) {
      return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    const vessel = await prisma.vessel.findFirst({
      where: { id: vesselId, ...notDeleted },
      select: { name: true, code: true },
    });

    const buffer = await buildMachineryRegisterTemplateWorkbook({
      vesselName: vessel?.name,
      vesselCode: vessel?.code,
    });
    const safeCode = (vessel?.code ?? "vessel").replace(/[^\w.-]+/g, "_") || "vessel";
    return excelAttachmentResponse(buffer, `${safeCode}-machinery-register-template.xlsx`);
  } catch (err) {
    console.error("[ship-access/machinery/assets/template] GET failed", err);
    return NextResponse.json({ error: "Failed to build machinery register template" }, { status: 500 });
  }
}
