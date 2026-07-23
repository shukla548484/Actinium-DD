import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { mapVesselJobCollaborateInput } from "@/lib/db/superintendent/vesselJobInput";
import {
  createCollaboratedDdVesselJobs,
  resolveVesselIdFromProject,
} from "@/lib/db/superintendent/vesselJobs";
import { ddVesselJobCollaborateSchema, parseBody } from "@/lib/superintendent/validation";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { isJobCategoryAllowedForCrew } from "@/lib/shipAccess/crewJobCategories";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const parsed = parseBody(ddVesselJobCollaborateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  let vesselId = parsed.data.vesselId;

  if (parsed.data.targetDryDockProjectId) {
    const projectVesselId = await resolveVesselIdFromProject(parsed.data.targetDryDockProjectId);
    if (!projectVesselId) {
      return NextResponse.json({ error: "Target dry dock project not found" }, { status: 404 });
    }
    vesselId = projectVesselId;
  }

  const vesselAccess = await assertShipVesselInScope(vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  const crew = await getCrewSessionContext();
  if (
    crew?.isVesselCrew &&
    !isJobCategoryAllowedForCrew(crew.roleCode, parsed.data.category)
  ) {
    return NextResponse.json(
      { error: "Your rank cannot create jobs in this category" },
      { status: 403 },
    );
  }

  const { submit } = parsed.data;
  const status = submit ? "submitted" : (parsed.data.status ?? "draft");

  try {
    const result = await createCollaboratedDdVesselJobs(
      mapVesselJobCollaborateInput(
        {
          ...parsed.data,
          createdByName: parsed.data.createdByName ?? crew?.designation ?? null,
          createdByRole: "vessel",
        },
        vesselId,
        status,
      ),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to collaborate jobs";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
