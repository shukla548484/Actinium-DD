import { NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/officePageAccess";

/** Office session + RBAC required for admin APIs. */
export async function requireAdminApiAccess(): Promise<NextResponse | null> {
  return requireAdminApiPermission();
}
