import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import {
  buildMachineryRegisterTemplateWorkbook,
  excelAttachmentResponse,
} from "@/lib/machinery/machineryRegisterExcel";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveVesselId(request: Request) {
  const { searchParams } = new URL(request.url);
  const dryDockProjectId = searchParams.get("dryDockProjectId");
  const vesselId = searchParams.get("vesselId");

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

export async function GET(request: Request) {
  try {
    const denied = await requireSuperintendentApiAccess();
    if (denied) return denied;

    const resolved = await resolveVesselId(request);
    if ("error" in resolved) return resolved.error;

    const vessel = await prisma.vessel.findFirst({
      where: { id: resolved.vesselId, ...notDeleted },
      select: { name: true, code: true },
    });

    const buffer = await buildMachineryRegisterTemplateWorkbook({
      vesselName: vessel?.name,
      vesselCode: vessel?.code,
    });
    const safeCode = (vessel?.code ?? "vessel").replace(/[^\w.-]+/g, "_") || "vessel";
    return excelAttachmentResponse(buffer, `${safeCode}-machinery-register-template.xlsx`);
  } catch (err) {
    console.error("[superintendent/machinery-assets/template] GET failed", err);
    return NextResponse.json({ error: "Failed to build machinery register template" }, { status: 500 });
  }
}
