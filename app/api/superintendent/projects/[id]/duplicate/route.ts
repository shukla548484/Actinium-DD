import { NextResponse } from "next/server";
import { duplicateDryDockProject } from "@/lib/db/superintendent/duplicateProject";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  name: z.string().min(2).optional(),
  copyScope: z.boolean().optional(),
});

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const project = await duplicateDryDockProject(id, {
    name: parsed.data.name,
    copyScope: parsed.data.copyScope,
    status: "draft",
  });

  if (!project) {
    return NextResponse.json({ error: "Source project not found" }, { status: 404 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
