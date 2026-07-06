import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import {
  getShipyardRfqQueueRow,
  patchShipyardRfqInvite,
  type YardInvitePatchInput,
} from "@/lib/db/shipyardRfq";
import {
  canAdvanceWorkflowStage,
  isYardRfqWorkflowStage,
} from "@/lib/shipyard/rfqWorkflow";
import type { YardRfqWorkflowStage } from "@/lib/shipyard/workflow";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess();
  if (denied) return denied;

  const { inviteId } = await context.params;
  const row = await getShipyardRfqQueueRow(inviteId);
  if (!row) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }
  return NextResponse.json({ row });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const { inviteId } = await context.params;
  let body: YardInvitePatchInput;
  try {
    body = (await request.json()) as YardInvitePatchInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.workflowStage && !isYardRfqWorkflowStage(body.workflowStage)) {
    return NextResponse.json({ error: "Invalid workflow stage." }, { status: 400 });
  }

  const existing = await getShipyardRfqQueueRow(inviteId);
  if (!existing) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }

  if (body.workflowStage) {
    const current = existing.workflowStage as YardRfqWorkflowStage;
    if (!canAdvanceWorkflowStage(current, body.workflowStage)) {
      return NextResponse.json(
        { error: `Cannot move workflow from ${current} to ${body.workflowStage}.` },
        { status: 400 },
      );
    }
  }

  const row = await patchShipyardRfqInvite(inviteId, body);
  if (!row) {
    return NextResponse.json({ error: "RFQ not found." }, { status: 404 });
  }

  return NextResponse.json({ row });
}
