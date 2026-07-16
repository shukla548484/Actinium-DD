import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  rejectClarification,
  closeClarification,
  serializeClarificationForView,
} from "@/lib/procurement/rfq-clarification-service";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManagePurchaseClarifications(user.designationAccessLevel)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = body.action as "reject" | "close";

    const row =
      action === "reject"
        ? await rejectClarification({
            clarificationId: id,
            employeeId: user.id,
            accessLevel: user.designationAccessLevel || 0,
            reason: body.reason,
            request,
          })
        : await closeClarification({
            clarificationId: id,
            employeeId: user.id,
            accessLevel: user.designationAccessLevel || 0,
            request,
          });

    return NextResponse.json({
      clarification: serializeClarificationForView(row, "office"),
    });
  } catch (error: any) {
    console.error("[rfq-clarification action]", error);
    return NextResponse.json(
      { error: error?.message || "Action failed" },
      { status: 400 }
    );
  }
}
