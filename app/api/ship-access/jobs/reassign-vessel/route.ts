import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { reassignDdVesselJobsToVessel } from "@/lib/db/superintendent/vesselJobs";
import { parseBody } from "@/lib/superintendent/validation";
import {
  assertShipVesselInScope,
  getShipAccessVesselIds,
} from "@/lib/shipAccess/scope";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1, "Select at least one job"),
  targetVesselId: z.string().min(1, "Target vessel is required"),
});

/**
 * Move selected ship-access jobs to another vessel in the user's assigned fleet.
 * Source and target vessels must both be in ship-access scope.
 */
export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = parseBody(bodySchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { jobIds, targetVesselId } = parsed.data;

  const targetAccess = await assertShipVesselInScope(targetVesselId);
  if (!targetAccess.ok) return targetAccess.response;

  const allowedVesselIds = await getShipAccessVesselIds();
  const rows = await prisma.ddVesselJob.findMany({
    where: { id: { in: jobIds }, ...notDeleted },
    select: { id: true, vesselId: true },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No matching jobs found" }, { status: 404 });
  }

  for (const row of rows) {
    if (!allowedVesselIds.includes(row.vesselId)) {
      return NextResponse.json(
        { error: "Forbidden — one or more jobs are outside your vessel scope" },
        { status: 403 },
      );
    }
  }

  const result = await reassignDdVesselJobsToVessel(jobIds, targetVesselId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const targetLabel =
    result.vesselJobs[0]?.vesselName && result.vesselJobs[0]?.vesselCode
      ? `${result.vesselJobs[0].vesselName} (${result.vesselJobs[0].vesselCode})`
      : "target vessel";

  return NextResponse.json({
    moved: result.moved,
    skipped: result.skipped,
    vesselJobs: result.vesselJobs,
    message:
      result.moved > 0
        ? `Moved ${result.moved} job${result.moved === 1 ? "" : "s"} to ${targetLabel}`
        : "No jobs were moved",
  });
}
