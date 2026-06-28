import { NextResponse } from "next/server";
import type { RbacUserType } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { listRolesWithPermissionCounts } from "@/lib/db/adminRbac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const userType = searchParams.get("userType") as RbacUserType | null;

  const roles = await listRolesWithPermissionCounts(userType ?? undefined);
  return NextResponse.json({ roles });
}
