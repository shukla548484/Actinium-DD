import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  listJobLibraryChildren,
  listJobLibraryRoots,
  searchStandardJobs,
} from "@/lib/vessel/jobLibrary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const search = searchParams.get("search");
  const projectType = searchParams.get("projectType");
  const vesselType = searchParams.get("vesselType");

  if (search) {
    const nodes = await searchStandardJobs(search);
    return NextResponse.json({ nodes });
  }

  if (parentId) {
    const nodes = await listJobLibraryChildren(parentId === "root" ? null : parentId);
    return NextResponse.json({ nodes });
  }

  const nodes = await listJobLibraryRoots(projectType, vesselType);
  return NextResponse.json({ nodes });
}
