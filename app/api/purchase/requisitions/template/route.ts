import { NextResponse } from "next/server";
import { requirePurchaseApiAccess, vesselScopeWhere } from "@/lib/auth/purchaseAccess";
import { prisma } from "@/lib/prisma";
import { buildRequisitionQuoteTemplateBuffer } from "@/lib/purchase/excelTemplates";

export const runtime = "nodejs";

/** POST /api/purchase/requisitions/template — Excel quote-request template */
export async function POST(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.requisitions");
  if ("denied" in access) return access.denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const vesselId = typeof b.vesselId === "string" ? b.vesselId : "";
  const requisitionType = typeof b.requisitionType === "string" ? b.requisitionType : "";
  if (!vesselId || !requisitionType) {
    return NextResponse.json(
      { error: "vesselId and requisitionType are required." },
      { status: 400 },
    );
  }

  const scope = vesselScopeWhere(access.ctx, vesselId);
  if (scope === null) {
    return NextResponse.json({ error: "Access denied to this vessel." }, { status: 403 });
  }

  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, deletedAt: null },
    select: { name: true, code: true },
  });
  if (!vessel) {
    return NextResponse.json({ error: "Vessel not found." }, { status: 404 });
  }

  const buffer = buildRequisitionQuoteTemplateBuffer({
    vesselName: vessel.name,
    vesselCode: vessel.code,
    requisitionType,
    heading: typeof b.heading === "string" ? b.heading : null,
    description: typeof b.description === "string" ? b.description : null,
    portOfSupply: typeof b.portOfSupply === "string" ? b.portOfSupply : null,
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `Quote_Request_Template_${requisitionType}_${date}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
