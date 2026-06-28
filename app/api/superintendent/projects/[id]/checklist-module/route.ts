import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getProjectChecklistModule } from "@/lib/db/superintendent/projectWorkspace";
import {
  categoriesForModule,
  isModuleChecklistKey,
} from "@/lib/superintendent/engine/moduleChecklist";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const moduleKey = new URL(request.url).searchParams.get("module") ?? "";
  if (!isModuleChecklistKey(moduleKey)) {
    return NextResponse.json({ error: "Invalid module key" }, { status: 400 });
  }

  const data = await getProjectChecklistModule(id, categoriesForModule(moduleKey));
  return NextResponse.json(data);
}
