import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  listRunningHoursEntries,
  recordRunningHours,
  recordRunningHoursBatch,
} from "@/lib/db/vesselMachineryAssets";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

const readingSchema = z.object({
  machineryAssetId: z.string().min(1),
  department: z.string().min(1),
  currentHours: z.number().int().min(0),
  lastJobDoneDate: z.string().nullable().optional(),
  nextDueHours: z.number().int().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
});

const createSchema = z.object({
  vesselId: z.string().optional(),
  machineryAssetId: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  currentHours: z.number().int().min(0).optional(),
  lastJobDoneDate: z.string().nullable().optional(),
  nextDueHours: z.number().int().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  verifiedBy: z.string().nullable().optional(),
  readings: z.array(readingSchema).min(1).max(500).optional(),
});

export async function GET(request: Request) {
  try {
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
  } catch (err) {
    console.error("[ship-access/machinery/running-hours] GET failed", err);
    return NextResponse.json({ error: "Failed to load running hours" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    if (parsed.data.readings?.length) {
      const result = await recordRunningHoursBatch(vesselId, parsed.data.readings, enteredBy);
      if (result.entries.length === 0 && result.failed.length > 0) {
        return NextResponse.json(
          {
            error: result.failed[0]?.error ?? "Failed to record running hours",
            failed: result.failed,
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          entries: result.entries,
          failed: result.failed,
          message: `Recorded ${result.entries.length} of ${parsed.data.readings.length} reading(s).`,
        },
        { status: 201 },
      );
    }

    if (!parsed.data.machineryAssetId || !parsed.data.department || parsed.data.currentHours == null) {
      return NextResponse.json(
        { error: "machineryAssetId, department, and currentHours are required" },
        { status: 400 },
      );
    }

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
  } catch (err) {
    console.error("[ship-access/machinery/running-hours] POST failed", err);
    return NextResponse.json({ error: "Failed to record running hours" }, { status: 500 });
  }
}
