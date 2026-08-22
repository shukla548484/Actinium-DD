import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import {
  assertVesselInUserScope,
  buildUserScope,
} from "@/lib/rbac/scopeRules";
import { getVesselCreateContext } from "@/lib/projects/createContext";
import { requireProjectsApiAccess } from "@/lib/projects/projectScope";
import { computeVesselSurveyStatus } from "@/lib/vessels/surveyWindows";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireProjectsApiAccess("page.office.projects.new");
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const scope = await buildUserScope(userId);
    const access = await assertVesselInUserScope(id, scope);
    if (!access.ok) return access.response;

    const vessel = await getVesselCreateContext(id);
    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    const surveyStatus = computeVesselSurveyStatus({
      lastDockingDate: vessel.dockingSurveyDate,
      lastIntermediateSurveyDate: vessel.lastIntermediateSurveyDate,
    });

    return NextResponse.json({ vessel, surveyStatus });
  } catch (err) {
    console.error("[api/projects/vessels/[id]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load vessel details" },
      { status: 500 },
    );
  }
}
