import { NextResponse } from "next/server";
import { requireSuperintendentApiPermission } from "@/lib/auth/officePageAccess";

/** Office session + superintendent RBAC required for superintendent APIs. */
export async function requireSuperintendentApiAccess(
  request?: Request,
): Promise<NextResponse | null> {
  return requireSuperintendentApiPermission(request);
}
