import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { previewDryDockProjectCode } from "@/lib/superintendent/projectCodes";
import { assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const vesselId = new URL(request.url).searchParams.get("vesselId")?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required" }, { status: 400 });
  }

  const access = await assertVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const projectCode = await previewDryDockProjectCode(vesselId);
  if (!projectCode) {
    return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  }

  return NextResponse.json({ projectCode });
}
