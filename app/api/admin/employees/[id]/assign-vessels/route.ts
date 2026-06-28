import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { assignVesselsSchema, parseBody } from "@/lib/admin/validation";
import { assignVesselsToEmployee, getAssignVesselsData } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const data = await getAssignVesselsData(id);
  if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(assignVesselsSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const employee = await assignVesselsToEmployee(
      id,
      parsed.data.vesselIds,
      parsed.data.watchKeeperVesselIds ?? [],
    );
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ employee, message: "Vessels assigned successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to assign vessels";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
