import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import {
  createYardCostEstimateVersion,
  listYardCostEstimateVersions,
} from "@/lib/db/yardCostEstimate";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess();
  if (denied) return denied;

  const { inviteId } = await context.params;
  const versions = await listYardCostEstimateVersions(inviteId);
  return NextResponse.json({ versions });
}

/** Create a new quote version (v2, v3…) — clone current, or apply a cost template. */
export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const { inviteId } = await context.params;
  let body: {
    versionLabel?: string;
    templateId?: string | null;
    cloneFromEstimateId?: string | null;
    setSelected?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const estimate = await createYardCostEstimateVersion(inviteId, body);
  if (!estimate) {
    return NextResponse.json({ error: "Unable to create quote version." }, { status: 404 });
  }

  const versions = await listYardCostEstimateVersions(inviteId);
  return NextResponse.json({ estimate, versions }, { status: 201 });
}
