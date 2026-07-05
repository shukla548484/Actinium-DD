import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { listParameterEntries, recordParameter } from "@/lib/db/vesselMachineryAssets";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  vesselId: z.string().optional(),
  machineryAssetId: z.string().min(1),
  parameterKey: z.string().min(1),
  parameterLabel: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullable().optional(),
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

  const entries = await listParameterEntries(vesselId);
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

  const entry = await recordParameter({
    vesselId,
    ...parsed.data,
    enteredBy,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
