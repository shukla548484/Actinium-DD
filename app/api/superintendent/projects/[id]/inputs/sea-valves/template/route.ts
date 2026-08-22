import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { getDefectImportVesselContext } from "@/lib/db/superintendent/projectDefects";
import { buildSeaValveImportTemplateWorkbook } from "@/lib/superintendent/seaValvesExcel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const vesselCtx = await getDefectImportVesselContext(id);
  if (!vesselCtx) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const buffer = await buildSeaValveImportTemplateWorkbook(vesselCtx);
  const safeCode = (vesselCtx.projectCode ?? vesselCtx.vesselCode ?? "project").replace(
    /[^\w.-]+/g,
    "_",
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeCode}-sea-valve-import-template.xlsx"`,
    },
  });
}
