import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { buildUserScope, resolveScopedVesselIds } from "@/lib/rbac/scopeRules";

export const dynamic = "force-dynamic";

/** Current user's RBAC scope dimensions (vessel / project / yard invite). */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const scope = await buildUserScope(userId);
  const vesselIds = await resolveScopedVesselIds(scope);

  return NextResponse.json({
    unrestricted: scope.unrestricted,
    vesselIds: vesselIds ?? null,
    projectIds: scope.projectIds,
    yardInviteIds: scope.yardInviteIds,
  });
}
