import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getOfficeSession } from "@/lib/auth/session";
import { crewHasPermission } from "@/lib/db/crewPageAccess";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import {
  crewApiPermissionForPath,
  crewPagePermissionForPath,
} from "@/lib/shipAccess/crewPages";

/** Office / vessel user session required for ship access APIs. Crew users need assigned page permissions. */
export async function requireShipAccessApiAccess(
  request?: Request,
): Promise<NextResponse | null> {
  const ok = await getOfficeSession();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  if (!request) return null;

  const crew = await getCrewSessionContext();
  if (!crew?.isVesselCrew || !crew.employeeId) return null;

  const url = new URL(request.url);
  const permissionKey = crewApiPermissionForPath(url.pathname, request.method, url.search);
  if (!permissionKey) return null;

  const allowed = await crewHasPermission(crew.employeeId, permissionKey);
  if (!allowed) {
    return NextResponse.json(
      { error: "You do not have access to this onboard feature." },
      { status: 403 },
    );
  }

  return null;
}

/** Redirect crew users away from ship-access pages they are not assigned. */
export async function enforceCrewPageAccess(pathname: string, search = ""): Promise<void> {
  const crew = await getCrewSessionContext();
  if (!crew?.isVesselCrew || !crew.employeeId) return;

  const permissionKey = crewPagePermissionForPath(pathname, search);
  if (!permissionKey) return;

  const allowed = await crewHasPermission(crew.employeeId, permissionKey);
  if (!allowed) {
    redirect("/ship-access");
  }
}
