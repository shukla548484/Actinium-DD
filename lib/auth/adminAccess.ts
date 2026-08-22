import { NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/officePageAccess";

/** Office session + RBAC required for admin APIs. */
export async function requireAdminApiAccess(request?: Request): Promise<NextResponse | null> {
  return requireAdminApiPermission(request);
}
