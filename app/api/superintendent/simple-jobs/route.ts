import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listDdSimpleJobs } from "@/lib/db/dryDockSimpleJobs";
import { assertVesselInScope } from "@/lib/superintendent/scope";
import { parsePagination } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const jobType = searchParams.get("jobType") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return access.response;
  }

  const result = await listDdSimpleJobs({
    page,
    limit,
    vesselId,
    status,
    jobType,
    search,
  });

  return NextResponse.json(result);
}
