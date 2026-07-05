import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listVesselRequisitions } from "@/lib/db/vesselRequisitions";
import { assertDryDockProjectInScope, assertVesselInScope } from "@/lib/superintendent/scope";
import { parsePagination } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePagination(searchParams);
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const dryDockProjectId = searchParams.get("dryDockProjectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const bankOnly = searchParams.get("bankOnly") === "true";

  if (dryDockProjectId) {
    const access = await assertDryDockProjectInScope(dryDockProjectId);
    if (!access.ok) return access.response;
  } else if (vesselId) {
    const access = await assertVesselInScope(vesselId);
    if (!access.ok) return access.response;
  }

  const result = await listVesselRequisitions({
    page,
    limit,
    vesselId,
    dryDockProjectId,
    status,
    search,
    bankOnly,
  });

  return NextResponse.json(result);
}
