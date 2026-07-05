import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listVesselPmsSchedule } from "@/lib/db/vesselPms";
import { assertVesselInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const vesselId = new URL(request.url).searchParams.get("vesselId");
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId required." }, { status: 400 });
  }

  const access = await assertVesselInScope(vesselId);
  if (!access.ok) return access.response;

  const data = await listVesselPmsSchedule(vesselId);
  return NextResponse.json(data);
}
