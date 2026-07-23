import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { mapVesselJobCollaborateInput } from "@/lib/db/superintendent/vesselJobInput";
import {
  createCollaboratedDdVesselJobs,
  resolveVesselIdFromProject,
} from "@/lib/db/superintendent/vesselJobs";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";
import { ddVesselJobCollaborateSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(ddVesselJobCollaborateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let vesselId = parsed.data.vesselId;

  if (parsed.data.targetDryDockProjectId) {
    const projectVesselId = await resolveVesselIdFromProject(parsed.data.targetDryDockProjectId);
    if (!projectVesselId) {
      return NextResponse.json({ error: "Target dry dock project not found" }, { status: 404 });
    }
    const access = await assertDryDockProjectInScope(parsed.data.targetDryDockProjectId);
    if (!access.ok) return access.response;
    vesselId = projectVesselId;
  }

  const vesselAccess = await assertVesselInScope(vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const { submit } = parsed.data;
  const status = submit ? "submitted" : (parsed.data.status ?? "draft");

  try {
    const result = await createCollaboratedDdVesselJobs(
      mapVesselJobCollaborateInput(parsed.data, vesselId, status),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to collaborate jobs";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
