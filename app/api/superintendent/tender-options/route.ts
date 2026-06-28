import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { dryDockProjectScopeWhere, getScopedVesselIds } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
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

  const tenderWhere = {
    ...notDeleted,
    ...(vesselId ? { vesselId } : {}),
    ...(vesselIds && !vesselId ? { vesselId: { in: vesselIds } } : {}),
  };

  const projects = await prisma.project.findMany({
    where: tenderWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, vesselId: true, vesselName: true, status: true },
    take: 200,
  });

  return NextResponse.json({ projects });
}
