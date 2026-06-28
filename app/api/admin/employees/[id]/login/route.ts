import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { ensureEmployeeLoginAccount } from "@/lib/db/employeeAuth";
import { getEmployee } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const employee = await getEmployee(id);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  try {
    const result = await ensureEmployeeLoginAccount(id);
    return NextResponse.json({
      ok: true,
      loginId: result.loginId,
      created: result.created,
      defaultPassword: result.created ? DEFAULT_EMPLOYEE_PASSWORD : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create login account";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
