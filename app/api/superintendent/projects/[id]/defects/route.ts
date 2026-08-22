import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { createProjectDefect, listProjectDefects } from "@/lib/db/superintendent/projectDefects";
import { ddProjectDefectCreateSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const defects = await listProjectDefects(id);
  return NextResponse.json(
    { defects },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const parsed = parseBody(ddProjectDefectCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await createProjectDefect({
      dryDockProjectId: id,
      ...parsed.data,
      createdByUserId: await getSessionUserId(),
    });
    return NextResponse.json(
      {
        defect: result.defect,
        defects: result.defects,
        submission: result.submission,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add defect";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
