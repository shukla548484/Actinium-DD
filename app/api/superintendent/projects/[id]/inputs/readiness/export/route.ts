import { NextResponse } from "next/server";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { buildCombinedInputReadiness, buildInputReadiness } from "@/lib/db/superintendent/inputs";
import { combinedReadinessToBuffer, inputReadinessToBuffer } from "@/lib/superintendent/exportInputReadiness";
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
    select: {
      name: true,
      referenceCode: true,
      projectType: true,
      vessel: { select: { name: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const pageKey = (searchParams.get("pageKey") as InputPageKey) || "vessel";
  const combined = searchParams.get("combined") === "true";
  const format = searchParams.get("format") ?? "json";

  const meta = {
    projectName: project.name,
    referenceCode: project.referenceCode,
    vesselName: project.vessel.name,
  };

  if (format === "xlsx" && combined) {
    const combinedReadiness = await buildCombinedInputReadiness(id, project.projectType);
    const buffer = combinedReadinessToBuffer(combinedReadiness, meta);
    const filename = `${project.referenceCode ?? id}-readiness-combined.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const readiness = await buildInputReadiness(id, project.projectType, pageKey);

  if (format === "xlsx") {
    const buffer = inputReadinessToBuffer(readiness, meta);
    const filename = `${project.referenceCode ?? id}-readiness-${pageKey}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ readiness });
}
