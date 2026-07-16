import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { approveFreightDeclaration } from "@/lib/freight/freight-service";

export const dynamic = "force-dynamic";

/** POST /api/purchase/freight/declarations/[id]/approve */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManageFreight(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await props.params;
    const declaration = await approveFreightDeclaration(id, user.id);
    return NextResponse.json({ success: true, declaration });
  } catch (error) {
    console.error("[freight/approve]", error);
    const message = error instanceof Error ? error.message : "Failed to approve";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
