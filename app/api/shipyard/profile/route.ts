import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { getOrCreateYardProfile, updateYardProfile, type YardProfilePatchInput } from "@/lib/db/yardProfile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const companyId = new URL(request.url).searchParams.get("companyId");
  const profile = await getOrCreateYardProfile(companyId);
  if (!profile) {
    return NextResponse.json(
      { error: "No shipyard company found. Register a shipyard under Admin → Shipyards." },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  let body: YardProfilePatchInput;
  try {
    body = (await request.json()) as YardProfilePatchInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const companyId = new URL(request.url).searchParams.get("companyId");
  const profile = await updateYardProfile(companyId, body);
  if (!profile) {
    return NextResponse.json({ error: "Unable to update yard profile." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
