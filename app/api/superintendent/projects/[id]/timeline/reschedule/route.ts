import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  lockProjectBaseline,
  rescheduleProjectMilestones,
} from "@/lib/db/superintendent/timelineActions";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { timelineRescheduleSchema, parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "reschedule";

  if (action === "lockBaseline") {
    const result = await lockProjectBaseline(id);
    return NextResponse.json(result);
  }

  const parsed = parseBody(timelineRescheduleSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const milestones = await rescheduleProjectMilestones(id, parsed.data.updates);
  return NextResponse.json({ milestones });
}
