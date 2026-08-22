import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { getDdSimpleJob, masterReviewDdSimpleJob } from "@/lib/db/dryDockSimpleJobs";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  ddSimpleJobMasterReviewSchema,
  parseDdSimpleJobBody,
} from "@/lib/dryDockJobs/validation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getDdSimpleJob(id);
  if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(existing.vesselId);
  if (!access.ok) return access.response;

  const parsed = parseDdSimpleJobBody(ddSimpleJobMasterReviewSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (parsed.data.action === "reject" && !parsed.data.rejectionReason?.trim()) {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  }

  const crew = await getCrewSessionContext();
  try {
    const job = await masterReviewDdSimpleJob(id, {
      action: parsed.data.action,
      actorName: parsed.data.actorName ?? crew?.designation ?? null,
      actorEmployeeId: crew?.employeeId ?? null,
      rejectionReason: parsed.data.rejectionReason ?? null,
    });
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 400 },
    );
  }
}
