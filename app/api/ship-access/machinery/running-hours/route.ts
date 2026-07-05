import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  listRunningHoursEntries,
  recordRunningHours,
} from "@/lib/db/vesselMachineryAssets";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vesselId: z.string().optional(),
  machineryAssetId: z.string().min(1),
  department: z.string().min(1),
  currentHours: z.number().int().min(0),
  lastJobDoneDate: z.string().nullable().optional(),
  nextDueHours: z.number().int().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const vesselId = searchParams.get("vesselId") ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const entries = await listRunningHoursEntries(vesselId);
  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const vesselId = parsed.data.vesselId ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
  }

  const access = await assertShipVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const crew = await getCrewSessionContext();
  const enteredBy =
    crew?.designation ?? crew?.roleName ?? crew?.vesselLoginId ?? "Onboard crew";

  const entry = await recordRunningHours({
    vesselId,
    machineryAssetId: parsed.data.machineryAssetId,
    department: parsed.data.department,
    currentHours: parsed.data.currentHours,
    lastJobDoneDate: parsed.data.lastJobDoneDate,
    nextDueHours: parsed.data.nextDueHours,
    nextDueDate: parsed.data.nextDueDate,
    enteredBy,
    verifiedBy: parsed.data.verifiedBy,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
