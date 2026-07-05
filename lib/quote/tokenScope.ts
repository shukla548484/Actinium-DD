import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { assertYardInviteTokenInUserScope, buildUserScope } from "@/lib/rbac/scopeRules";

/** Optional scope gate when a user is signed in while using a yard quote token link. */
export async function requireQuoteTokenScope(token: string): Promise<NextResponse | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const scope = await buildUserScope(userId);
  const access = await assertYardInviteTokenInUserScope(token, scope);
  if (!access.ok) return access.response;
  return null;
}
