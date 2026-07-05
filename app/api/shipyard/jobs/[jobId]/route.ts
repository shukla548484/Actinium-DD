import { NextResponse } from "next/server";
import { requireWorkshopJobAccess } from "@/lib/auth/shipyardAccess";
import { updateWorkshopJob } from "@/lib/db/yardExecution";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const denied = await requireWorkshopJobAccess(jobId, req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const job = await updateWorkshopJob(jobId, {
      status: body.status as Parameters<typeof updateWorkshopJob>[1]["status"],
      progressPct: typeof body.progressPct === "number" ? body.progressPct : undefined,
      plannedStart: typeof body.plannedStart === "string" ? body.plannedStart : body.plannedStart === null ? null : undefined,
      plannedFinish: typeof body.plannedFinish === "string" ? body.plannedFinish : body.plannedFinish === null ? null : undefined,
      actualStart: typeof body.actualStart === "string" ? body.actualStart : body.actualStart === null ? null : undefined,
      actualFinish: typeof body.actualFinish === "string" ? body.actualFinish : body.actualFinish === null ? null : undefined,
      delayReason: typeof body.delayReason === "string" ? body.delayReason : body.delayReason === null ? null : undefined,
      remarks: typeof body.remarks === "string" ? body.remarks : body.remarks === null ? null : undefined,
      priority: body.priority as Parameters<typeof updateWorkshopJob>[1]["priority"],
    });
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 },
    );
  }
}
