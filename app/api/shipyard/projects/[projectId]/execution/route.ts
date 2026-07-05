import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import {
  getYardWorkProjectByProjectId,
  initWorkshopJobsFromSpec,
} from "@/lib/db/yardExecution";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const denied = await requireShipyardApiAccess(_req);
  if (denied) return denied;

  const { projectId } = await ctx.params;
  const data = await getYardWorkProjectByProjectId(projectId);
  return NextResponse.json(data);
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const denied = await requireShipyardApiAccess(_req);
  if (denied) return denied;

  try {
    const { projectId } = await ctx.params;
    const data = await initWorkshopJobsFromSpec(projectId, true);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to initialize execution jobs" },
      { status: 500 },
    );
  }
}
