import { NextResponse } from "next/server";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { buildCombinedInputReadiness, buildInputReadiness } from "@/lib/db/superintendent/inputs";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const project = await prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
    select: { projectType: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const combined = searchParams.get("combined") === "true";

  if (combined) {
    const combinedReadiness = await buildCombinedInputReadiness(id, project.projectType);
    return NextResponse.json({ combinedReadiness });
  }

  const pageKey = (searchParams.get("pageKey") as InputPageKey) || "vessel";
  const readiness = await buildInputReadiness(id, project.projectType, pageKey);
  return NextResponse.json({ readiness });
}
