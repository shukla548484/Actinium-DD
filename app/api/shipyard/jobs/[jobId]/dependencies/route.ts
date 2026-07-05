import { NextResponse } from "next/server";
import { requireShipyardApiAccess, requireWorkshopJobAccess } from "@/lib/auth/shipyardAccess";
import { addJobDependency, removeJobDependency } from "@/lib/db/yardExecution";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId: successorJobId } = await ctx.params;
  const denied = await requireWorkshopJobAccess(successorJobId, req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { predecessorJobId?: string; lagDays?: number };
    if (!body.predecessorJobId) {
      return NextResponse.json({ error: "predecessorJobId required" }, { status: 400 });
    }
    await addJobDependency(successorJobId, body.predecessorJobId, body.lagDays ?? 0);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add dependency" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId: successorJobId } = await ctx.params;
  const denied = await requireWorkshopJobAccess(successorJobId, req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as { predecessorJobId?: string };
    if (!body.predecessorJobId) {
      return NextResponse.json({ error: "predecessorJobId required" }, { status: 400 });
    }
    await removeJobDependency(successorJobId, body.predecessorJobId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to remove dependency" },
      { status: 500 },
    );
  }
}
