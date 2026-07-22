import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { parseBody } from "@/lib/admin/validation";
import {
  getEmployeeModuleAccessDetail,
  setEmployeeModuleAccess,
} from "@/lib/db/employeeModuleAccess";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const assignModulesSchema = z.object({
  assignments: z.array(
    z.object({
      moduleCode: z.string().min(1),
      pageKeys: z.array(z.string().min(1)),
    }),
  ),
});

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const data = await getEmployeeModuleAccessDetail(id);
  if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(assignModulesSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const detail = await setEmployeeModuleAccess(id, parsed.data.assignments);
    if (!detail) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({
      detail,
      message: "Module and page assignments saved.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save assignments";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
