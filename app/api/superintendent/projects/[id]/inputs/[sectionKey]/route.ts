import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  buildInputReadiness,
  deactivateInputSubmission,
  getActiveInputSubmission,
  reviewInputSubmission,
  softDeleteInputSubmission,
  upsertInputSubmission,
} from "@/lib/db/superintendent/inputs";
import { findDryDockProject } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ddInputReviewSchema, ddInputUpsertSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; sectionKey: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id, sectionKey } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const submission = await getActiveInputSubmission(id, sectionKey);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ submission });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id, sectionKey } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const parsed = parseBody(ddInputUpsertSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.data.sectionKey !== sectionKey) {
    return NextResponse.json({ error: "Section key mismatch" }, { status: 400 });
  }

  try {
    const submission = await upsertInputSubmission({
      dryDockProjectId: id,
      ...parsed.data,
    });
    return NextResponse.json({ submission });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save input";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id, sectionKey } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const body = await request.json();
  const action = body?.action as string | undefined;

  if (action === "deactivate") {
    const existing = await getActiveInputSubmission(id, sectionKey);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const submission = await deactivateInputSubmission(existing.id);
    return NextResponse.json({ submission });
  }

  if (action === "delete") {
    const existing = await getActiveInputSubmission(id, sectionKey);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Only draft inputs can be deleted" }, { status: 400 });
    }
    await softDeleteInputSubmission(existing.id);
    return NextResponse.json({ ok: true });
  }

  const parsed = parseBody(ddInputReviewSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getActiveInputSubmission(id, sectionKey);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submission = await reviewInputSubmission(existing.id, parsed.data);
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await findDryDockProject(id);
  const readiness = project
    ? await buildInputReadiness(id, project.projectType, "vessel")
    : null;

  return NextResponse.json({ submission, readiness });
}
