import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";
import { buildUserScope, resolveScopedVesselIds } from "@/lib/rbac/scopeRules";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const SHIP_ACCESS_VESSEL_COOKIE = "ship_access_vessel_id";

export type ShipAccessVessel = {
  id: string;
  code: string;
  name: string;
};

/** Vessels the signed-in user may access from ship-side modules. */
export async function getShipAccessVesselIds(): Promise<string[]> {
  const payload = await getSessionPayload();
  if (payload?.officeBootstrap) {
    const rows = await prisma.vessel.findMany({
      where: { ...notDeleted, status: "active" },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => r.id);
  }

  const userId = await getSessionUserId();
  if (!userId) return [];

  const scope = await buildUserScope(userId);
  if (scope.unrestricted) {
    const rows = await prisma.vessel.findMany({
      where: { ...notDeleted, status: "active" },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => r.id);
  }

  const vesselIds = await resolveScopedVesselIds(scope);
  return vesselIds ?? [];
}

export async function listShipAccessVessels(): Promise<ShipAccessVessel[]> {
  const ids = await getShipAccessVesselIds();
  if (ids.length === 0) return [];

  return prisma.vessel.findMany({
    where: { id: { in: ids }, ...notDeleted },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getSelectedShipVesselId(): Promise<string | null> {
  const allowed = await getShipAccessVesselIds();
  if (allowed.length === 0) return null;

  const jar = await cookies();
  const fromCookie = jar.get(SHIP_ACCESS_VESSEL_COOKIE)?.value?.trim();
  if (fromCookie && allowed.includes(fromCookie)) return fromCookie;

  return allowed[0] ?? null;
}

export async function assertShipVesselInScope(
  vesselId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const allowed = await getShipAccessVesselIds();
  if (!allowed.includes(vesselId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — vessel not in your ship access scope" }, { status: 403 }),
    };
  }
  return { ok: true };
}
