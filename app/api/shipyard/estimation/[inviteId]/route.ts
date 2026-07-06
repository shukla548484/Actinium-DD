import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import {
  applyTemplateToEstimateVersion,
  getYardCostEstimateForInvite,
  saveYardCostEstimate,
  type YardCostEstimateLineInput,
} from "@/lib/db/yardCostEstimate";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const { inviteId } = await context.params;
  const url = new URL(request.url);
  const versionNo = url.searchParams.get("version");
  const estimateId = url.searchParams.get("estimateId");

  const result = await getYardCostEstimateForInvite(inviteId, {
    versionNo: versionNo ? Number(versionNo) : undefined,
    estimateId: estimateId ?? undefined,
  });
  if (!result) {
    return NextResponse.json({ error: "RFQ or estimate not found." }, { status: 404 });
  }

  return NextResponse.json({
    estimate: result.estimate,
    versions: result.versions,
    invite: {
      id: result.rfq.invite.id,
      yardName: result.rfq.invite.yardName,
      projectId: result.rfq.invite.projectId,
      workflowStage: result.rfq.workflowStage,
    },
    project: {
      id: result.rfq.project.id,
      name: result.rfq.project.name,
      vesselName: result.rfq.project.vesselName,
      currency: result.rfq.project.currency,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const { inviteId } = await context.params;
  let body: {
    estimateId?: string;
    marginPct?: number;
    notes?: string | null;
    status?: string;
    isSelectedForQuote?: boolean;
    templateId?: string;
    lines?: YardCostEstimateLineInput[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.templateId && body.estimateId) {
    const estimate = await applyTemplateToEstimateVersion(
      inviteId,
      body.estimateId,
      body.templateId,
    );
    if (!estimate) {
      return NextResponse.json({ error: "Unable to apply template." }, { status: 404 });
    }
    return NextResponse.json({ estimate });
  }

  const estimate = await saveYardCostEstimate(inviteId, body);
  if (!estimate) {
    return NextResponse.json({ error: "Unable to save estimate." }, { status: 404 });
  }

  return NextResponse.json({ estimate });
}
