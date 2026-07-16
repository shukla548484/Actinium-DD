import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { issueFreightPurchaseOrder } from "@/lib/freight/freight-service";

export const dynamic = "force-dynamic";

/** POST /api/purchase/freight/declarations/[id]/issue-po — create {parent}.FRT PO */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(_request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageFreight(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await props.params;
    const result = await issueFreightPurchaseOrder({
      declarationId: id,
      issuedById: user.id,
    });

    return NextResponse.json({
      success: true,
      freightPo: result.freightPo,
      freightPoNumber: result.freightPoNumber,
    });
  } catch (error) {
    console.error("[freight/issue-po]", error);
    const message = error instanceof Error ? error.message : "Failed to issue freight PO";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
