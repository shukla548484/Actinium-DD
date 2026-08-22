import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import {
  assertVesselInUserScope,
  buildUserScope,
} from "@/lib/rbac/scopeRules";
import { previewTenderProjectCode } from "@/lib/projects/createContext";
import { requireProjectsApiAccess } from "@/lib/projects/projectScope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireProjectsApiAccess("page.office.projects.new");
  if (denied) return denied;

  const vesselId = new URL(request.url).searchParams.get("vesselId")?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await buildUserScope(userId);
  const access = await assertVesselInUserScope(vesselId, scope);
  if (!access.ok) return access.response;

  const projectCode = await previewTenderProjectCode(vesselId);
  if (!projectCode) {
    return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  }

  return NextResponse.json({ projectCode });
}
