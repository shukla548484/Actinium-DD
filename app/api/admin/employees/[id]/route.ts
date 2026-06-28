import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { employeeUpdateSchema, parseBody, statusBodySchema } from "@/lib/admin/validation";
import {
  deleteEmployee,
  getEmployee,
  setEmployeeStatus,
  updateEmployee,
} from "@/lib/db/employees";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(employeeUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  try {
    const employee = await updateEmployee(id, parsed.data);
    return NextResponse.json({ employee });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update employee";
    if (msg.includes("Unique constraint") || msg.includes("already registered")) {
      return NextResponse.json({ error: msg.includes("already") ? msg : "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(statusBodySchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const employee = await setEmployeeStatus(id, parsed.data.status);
  return NextResponse.json({ employee });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  await deleteEmployee(id);
  return NextResponse.json({ ok: true });
}
