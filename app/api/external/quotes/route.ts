import { NextResponse } from "next/server";
import { requireExternalApiAccess, getExternalSessionContext } from "@/lib/auth/externalAccess";
import { buildUserScope } from "@/lib/rbac/scopeRules";
import { getExternalVendorQuotes } from "@/lib/db/externalPortal";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireExternalApiAccess();
  if (denied) return denied;

  const session = await getExternalSessionContext();
  if (!session?.user.email) {
    return NextResponse.json({ quotes: [], message: "No email on profile — quotes matched by invite email." });
  }

  const scope = await buildUserScope(session.user.userId);
  const yardFilter =
    !scope.unrestricted && scope.yardInviteIds.length > 0 ? scope.yardInviteIds : undefined;

  const quotes = await getExternalVendorQuotes(session.user.email, yardFilter);
  return NextResponse.json({ quotes });
}
