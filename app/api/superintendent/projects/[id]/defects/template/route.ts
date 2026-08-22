import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { getDefectImportVesselContext } from "@/lib/db/superintendent/projectDefects";
import { buildDefectImportTemplateWorkbook } from "@/lib/superintendent/defectsExcel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

function excelAttachmentResponse(buffer: Buffer, filename: string): NextResponse {
  const body = Uint8Array.from(buffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    const denied = await requireSuperintendentApiAccess(request);
    if (denied) return denied;

    const { id } = await ctx.params;
    const access = await assertDryDockProjectInScope(id);
    if (!access.ok) return access.response;

    const vesselCtx = await getDefectImportVesselContext(id);
    if (!vesselCtx) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const buffer = await buildDefectImportTemplateWorkbook(vesselCtx);
    const safeCode =
      (vesselCtx.projectCode ?? vesselCtx.vesselCode ?? "project").replace(/[^\w.-]+/g, "_") ||
      "project";

    return excelAttachmentResponse(buffer, `${safeCode}-defect-import-template.xlsx`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build defect import template.";
    console.error("[defects/template] GET failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
