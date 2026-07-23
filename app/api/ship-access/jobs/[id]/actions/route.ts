import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  archiveDdVesselJob,
  assignDdVesselJobForExport,
  assignDdVesselJobParty,
  getDdVesselJob,
  reopenDdVesselJobForUpdate,
} from "@/lib/db/superintendent/vesselJobs";
import { parseBody } from "@/lib/superintendent/validation";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";
import {
  VESSEL_JOB_ASSIGNED_PARTY_LABELS,
  VESSEL_JOB_ASSIGNED_PARTY_VALUES,
} from "@/lib/superintendent/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const assignedPartySchema = z.enum([
  VESSEL_JOB_ASSIGNED_PARTY_VALUES[0],
  ...VESSEL_JOB_ASSIGNED_PARTY_VALUES.slice(1),
]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("assign_export") }),
  z.object({ action: z.literal("reopen_update") }),
  z.object({
    action: z.literal("assign_party"),
    assignedParty: assignedPartySchema.nullable(),
  }),
]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const { id } = await context.params;
    const existing = await getDdVesselJob(id);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing.archivedAt) {
      return NextResponse.json({ error: "Job is archived" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(existing.vesselId);
    if (!access.ok) return access.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseBody(actionSchema, body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    switch (parsed.data.action) {
      case "archive": {
        const vesselJob = await archiveDdVesselJob(id);
        if (!vesselJob) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        return NextResponse.json({ vesselJob, message: "Job archived" });
      }
      case "assign_export": {
        const vesselJob = await assignDdVesselJobForExport(id);
        if (!vesselJob) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        return NextResponse.json({
          vesselJob,
          message: `Assigned for export as ${vesselJob.jobCode}`,
        });
      }
      case "assign_party": {
        const vesselJob = await assignDdVesselJobParty(id, parsed.data.assignedParty);
        if (!vesselJob) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        const label = parsed.data.assignedParty
          ? VESSEL_JOB_ASSIGNED_PARTY_LABELS[parsed.data.assignedParty]
          : "Unassigned";
        return NextResponse.json({
          vesselJob,
          message: parsed.data.assignedParty
            ? `Job assigned to ${label}`
            : "Job assignment cleared",
        });
      }
      case "reopen_update": {
        const result = await reopenDdVesselJobForUpdate(id);
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({
          vesselJob: result.vesselJob,
          message: "Job reopened for update",
        });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[ship-access/jobs/actions]", err);
    const message = err instanceof Error ? err.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
