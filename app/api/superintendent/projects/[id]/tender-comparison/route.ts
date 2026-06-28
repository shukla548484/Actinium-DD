import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { buildHybridComparison } from "@/lib/tender/buildHybridComparison";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const ddProject = await prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
    select: { projectId: true, tenderProject: { select: { id: true, name: true } } },
  });

  if (!ddProject?.projectId) {
    return NextResponse.json(
      { error: "No tender project linked. Edit the dry dock project to link one." },
      { status: 404 },
    );
  }

  const comparison = await buildHybridComparison(ddProject.projectId);
  if (!comparison) {
    return NextResponse.json({ error: "Tender project not found" }, { status: 404 });
  }

  return NextResponse.json({ comparison });
}
