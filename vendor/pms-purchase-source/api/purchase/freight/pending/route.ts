import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { listPendingFreightDeclarations } from "@/lib/freight/freight-service";

export const dynamic = "force-dynamic";

/** GET /api/purchase/freight/pending — vendor submissions awaiting purchaser approval */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageFreight(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const declarations = await listPendingFreightDeclarations();
    return NextResponse.json({ success: true, declarations, count: declarations.length });
  } catch (error) {
    console.error("[freight/pending GET]", error);
    const message = error instanceof Error ? error.message : "Failed to list pending freight";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
