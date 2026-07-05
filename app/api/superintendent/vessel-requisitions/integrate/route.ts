import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { integrateVesselRequisitions } from "@/lib/db/vesselRequisitions";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import {
  parseRequisitionBody,
  vesselRequisitionIntegrateSchema,
} from "@/lib/shipAccess/requisitionValidation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseRequisitionBody(vesselRequisitionIntegrateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  try {
    const result = await integrateVesselRequisitions(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ converted: result.converted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Integration failed" },
      { status: 400 },
    );
  }
}
