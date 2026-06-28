import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { setRolePagePermissions, setRolePermissions } from "@/lib/db/adminRbac";

export const dynamic = "force-dynamic";

type Body = {
  permissionKeys?: string[];
  pagePermissionKeys?: string[];
  /** When true, only updates page.* permissions and keeps action permissions. */
  pagesOnly?: boolean;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await params;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const keys = body.pagePermissionKeys ?? body.permissionKeys;
  if (!Array.isArray(keys)) {
    return NextResponse.json({ error: "permissionKeys or pagePermissionKeys required." }, { status: 400 });
  }

  const role =
    body.pagesOnly || body.pagePermissionKeys
      ? await setRolePagePermissions(id, keys)
      : await setRolePermissions(id, keys);

  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    permissionKeys: role.rolePermissions.map((rp) => rp.permission.key),
  });
}
