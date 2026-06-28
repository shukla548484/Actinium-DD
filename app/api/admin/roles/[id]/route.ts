import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getRoleWithPermissions } from "@/lib/db/adminRbac";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await params;
  const role = await getRoleWithPermissions(id);
  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  }

  return NextResponse.json({
    role: {
      id: role.id,
      roleNo: role.roleNo,
      code: role.code,
      name: role.name,
      userType: role.userType,
      hierarchyLevel: role.hierarchyLevel,
      designation: role.designation,
      department: role.department,
      description: role.description,
      userCount: role._count.userRoles,
      permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        key: rp.permission.key,
        module: rp.permission.module,
        description: rp.permission.description,
        appSurface: rp.permission.appSurface,
        resource: rp.permission.resource,
      })),
    },
  });
}
