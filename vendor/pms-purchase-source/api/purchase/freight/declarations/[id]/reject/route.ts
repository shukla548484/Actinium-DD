import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { canManageFreight } from "@/lib/freight/constants";
import { rejectFreightDeclaration } from "@/lib/freight/freight-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().min(1),
});

/** POST /api/purchase/freight/declarations/[id]/reject */
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
    const { reason } = bodySchema.parse(await request.json());
    const declaration = await rejectFreightDeclaration(id, user.id, reason);
    return NextResponse.json({ success: true, declaration });
  } catch (error) {
    console.error("[freight/reject]", error);
    const message = error instanceof Error ? error.message : "Failed to reject";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
