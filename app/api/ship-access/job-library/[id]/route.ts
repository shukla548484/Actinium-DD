import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { getJobLibraryNode, getJobLibraryPath } from "@/lib/vessel/jobLibrary";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const node = await getJobLibraryNode(id);
  if (!node) {
    return NextResponse.json({ error: "Job library node not found" }, { status: 404 });
  }

  const path = node.nodeType === "standard_job" ? await getJobLibraryPath(id) : [];
  return NextResponse.json({ node, path });
}
