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

/** Strip catalog to plain JSON-safe fields for the client. */
function toClientDetail(
  data: NonNullable<Awaited<ReturnType<typeof getEmployeeModuleAccessDetail>>>,
) {
  return {
    employee: data.employee,
    assignedModuleCodes: data.assignedModuleCodes,
    assignedPages: data.assignedPages,
    availableModules: data.availableModules.map((mod) => {
      const seen = new Set<string>();
      const pages = [];
      for (const page of mod.pages) {
        if (seen.has(page.key)) continue;
        seen.add(page.key);
        pages.push({
          key: page.key,
          label: page.label,
          description: page.description ?? null,
          route: page.route ?? null,
        });
      }
      return {
        code: mod.code,
        label: mod.label,
        description: mod.description,
        pages,
      };
    }),
  };
}

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminApiAccess();
    if (denied) return denied;

    const { id } = await ctx.params;
    const data = await getEmployeeModuleAccessDetail(id);
    if (!data) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json(toClientDetail(data));
  } catch (e) {
    console.error("[assign-modules GET]", e);
    const msg = e instanceof Error ? e.message : "Failed to load module assignments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminApiAccess();
    if (denied) return denied;

    const { id } = await ctx.params;
    const parsed = parseBody(assignModulesSchema, await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const detail = await setEmployeeModuleAccess(id, parsed.data.assignments);
    if (!detail) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({
      detail: toClientDetail(detail),
      message: "Module and page assignments saved.",
    });
  } catch (e) {
    console.error("[assign-modules PUT]", e);
    const msg = e instanceof Error ? e.message : "Failed to save assignments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
