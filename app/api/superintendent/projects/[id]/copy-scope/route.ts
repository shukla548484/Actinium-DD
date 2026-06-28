import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { copyProjectScopeTo } from "@/lib/db/superintendent/copyScope";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  sourceProjectId: z.string().min(1, "Source project is required"),
});

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") }, { status: 400 });
  }

  const sourceAccess = await assertDryDockProjectInScope(parsed.data.sourceProjectId);
  if (!sourceAccess.ok) return sourceAccess.response;

  const ok = await copyProjectScopeTo(id, parsed.data.sourceProjectId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to copy scope" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
