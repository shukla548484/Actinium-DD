import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  listJobLibraryChildren,
  listJobLibraryRoots,
  searchStandardJobs,
} from "@/lib/vessel/jobLibrary";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export const dynamic = "force-dynamic";

async function resolveProjectType(
  dryDockProjectId: string | null,
  projectTypeParam: string | null,
): Promise<string | null> {
  if (projectTypeParam) return projectTypeParam;
  if (!dryDockProjectId) return null;
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { projectType: true },
  });
  return project?.projectType ?? null;
}

async function resolveVesselType(
  vesselId: string | null,
  vesselTypeParam: string | null,
): Promise<string | null> {
  if (vesselTypeParam) return vesselTypeParam;
  if (!vesselId) return null;
  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted },
    select: { vesselType: true },
  });
  return vessel?.vesselType ?? null;
}

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const search = searchParams.get("search");
  const dryDockProjectId = searchParams.get("dryDockProjectId");
  const vesselId = searchParams.get("vesselId");

  const [projectType, vesselType] = await Promise.all([
    resolveProjectType(dryDockProjectId, searchParams.get("projectType")),
    resolveVesselType(vesselId, searchParams.get("vesselType")),
  ]);

  if (search) {
    const nodes = await searchStandardJobs(search);
    return NextResponse.json({ nodes, projectType, vesselType });
  }

  if (parentId === "root" || parentId === null) {
    const nodes =
      parentId === "root" || !searchParams.has("parentId")
        ? await listJobLibraryRoots(projectType, vesselType)
        : await listJobLibraryChildren(null);
    return NextResponse.json({ nodes, projectType, vesselType });
  }

  if (parentId) {
    const nodes = await listJobLibraryChildren(parentId);
    return NextResponse.json({ nodes, projectType, vesselType });
  }

  const nodes = await listJobLibraryRoots(projectType, vesselType);
  return NextResponse.json({ nodes, projectType, vesselType });
}
