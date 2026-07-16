import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import { listClarifications, serializeClarificationForView } from "@/lib/procurement/rfq-clarification-service";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications";
import {
  clarificationResponseDueAt,
  isClarificationOverdue,
  processOpenClarificationEscalations,
} from "@/lib/procurement/clarification-escalation";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const requisitionId = searchParams.get("requisitionId") || undefined;
    const vendorQuoteId = searchParams.get("vendorQuoteId") || undefined;
    const status = searchParams.get("status") as any;
    const pendingOnly = searchParams.get("pending") === "1";

    const accessLevel = user.designationAccessLevel || 0;
    const isOffice = canManagePurchaseClarifications(accessLevel);
    const isVessel = accessLevel >= 6 && accessLevel <= 25;

    if (!isOffice && !isVessel) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const vesselId =
      isVessel && user.vesselId ? user.vesselId : searchParams.get("vesselId") || undefined;

    if (isOffice) {
      await processOpenClarificationEscalations({
        vesselId: vesselId || undefined,
        requisitionId,
      });
    }

    const rows = await listClarifications({
      requisitionId,
      vendorQuoteId,
      vesselId: isVessel ? vesselId : undefined,
      status: pendingOnly ? "OPEN" : status,
    });

    const view = isOffice ? "office" : "vessel";
    const clarifications = rows.map((r) => {
      const serialized = serializeClarificationForView(r, view);
      if (!serialized) return serialized;
      return {
        ...serialized,
        responseDueAt: clarificationResponseDueAt(r.requestedAt).toISOString(),
        isOverdue: r.status === "OPEN" && isClarificationOverdue(r.requestedAt),
      };
    });

    return NextResponse.json({
      clarifications,
      openCount: rows.filter((r) => r.status === "OPEN").length,
    });
  } catch (error) {
    console.error("[rfq-clarifications GET]", error);
    return NextResponse.json({ error: "Failed to list clarifications" }, { status: 500 });
  }
}
