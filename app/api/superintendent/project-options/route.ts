import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { notDeleted } from "@/lib/superintendent/helpers";
import { dryDockProjectScopeWhere, getScopedVesselIds } from "@/lib/superintendent/scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const vesselIds = await getScopedVesselIds();

  if (vesselId && vesselIds && !vesselIds.includes(vesselId)) {
    return NextResponse.json({ projects: [] });
  }

  const projects = await prisma.dryDockProject.findMany({
    where: {
      ...notDeleted,
      ...dryDockProjectScopeWhere(vesselIds),
      ...(vesselId ? { vesselId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ projects });
}
