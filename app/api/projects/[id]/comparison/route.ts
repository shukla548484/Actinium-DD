import { NextResponse } from "next/server";
import { buildHybridComparison } from "@/lib/tender/buildHybridComparison";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const comparison = await buildHybridComparison(id);
  if (!comparison) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ comparison });
}
