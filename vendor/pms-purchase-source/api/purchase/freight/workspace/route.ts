import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { getFreightWorkspaceBundle } from "@/lib/freight/freight-service";

export const dynamic = "force-dynamic";

/** GET /api/purchase/freight/workspace?requisitionId=&parentPurchaseOrderId= */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageFreight(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requisitionId = searchParams.get("requisitionId");
    const parentPurchaseOrderId = searchParams.get("parentPurchaseOrderId") ?? undefined;

    if (!requisitionId) {
      return NextResponse.json({ error: "requisitionId is required" }, { status: 400 });
    }

    const bundle = await getFreightWorkspaceBundle(requisitionId, parentPurchaseOrderId);
    if (!bundle) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      requisition: bundle.requisition,
      goodsPo: bundle.goodsPo,
      declaration: bundle.declaration,
      previewFreightPoNumber: bundle.previewFreightPoNumber,
    });
  } catch (error) {
    console.error("[freight/workspace GET]", error);
    const message = error instanceof Error ? error.message : "Failed to load freight workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
