import { NextResponse } from "next/server";
import { listPermissions, listSystemRoles } from "@/lib/db/rbac";

export const dynamic = "force-dynamic";

/** Public catalog of system roles and permissions (for admin UI / integration). */
export async function GET() {
  const [roles, permissions] = await Promise.all([listSystemRoles(), listPermissions()]);
  return NextResponse.json({ roles, permissions });
}
