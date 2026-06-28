import { NextResponse } from "next/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { resetEmployeePassword } from "@/lib/db/employeeAuth";
import { getEmployee } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const employee = await getEmployee(id);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const body = (await request.json()) as { newPassword?: string; resetToDefault?: boolean };
  const newPassword = body.resetToDefault ? undefined : body.newPassword;

  if (newPassword != null && newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const result = await resetEmployeePassword(id, newPassword);
    return NextResponse.json({
      ok: true,
      loginId: result.loginId,
      resetToDefault: Boolean(body.resetToDefault),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to reset password";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
