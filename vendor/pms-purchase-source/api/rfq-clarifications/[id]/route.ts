import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  getClarificationById,
  serializeClarificationForView,
} from "@/lib/procurement/rfq-clarification-service";
import {
  canManagePurchaseClarifications,
  canRespondToVesselClarification,
} from "@/lib/procurement/clarification-notifications";
import { getEligibleResponderAccessLevels } from "@/lib/procurement/clarification-responders";
import { listEntityAuditTimeline } from "@/lib/procurement/platform-audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const viewParam = new URL(request.url).searchParams.get("view");
    const accessLevel = user.designationAccessLevel || 0;
    const isOffice = canManagePurchaseClarifications(accessLevel);
    const isVessel = accessLevel >= 6 && accessLevel <= 25;

    let view: "office" | "vessel" = "office";
    if (viewParam === "vessel" || (!isOffice && isVessel)) view = "vessel";
    if (viewParam === "office" && isOffice) view = "office";

    const row = await getClarificationById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (isVessel && user.vesselId && row.vesselId !== user.vesselId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const creatorAccessLevel = row.requisition.createdBy?.designationAccessLevel ?? null;
    const eligibleResponderLevels =
      creatorAccessLevel != null ? getEligibleResponderAccessLevels(creatorAccessLevel) : [];
    const canRespond =
      row.status === "OPEN" &&
      creatorAccessLevel != null &&
      canRespondToVesselClarification(accessLevel, creatorAccessLevel);

    const includeHistory = new URL(request.url).searchParams.get("history") === "1";
    const history = includeHistory
      ? await listEntityAuditTimeline("RfqClarification", id)
      : undefined;

    return NextResponse.json({
      clarification: serializeClarificationForView(row, view),
      canRespond,
      eligibleResponderLevels,
      creatorAccessLevel,
      history,
    });
  } catch (error) {
    console.error("[rfq-clarification GET]", error);
    return NextResponse.json({ error: "Failed to load clarification" }, { status: 500 });
  }
}
