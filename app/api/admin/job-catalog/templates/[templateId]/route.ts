import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getJobCatalogTemplateDetail } from "@/lib/db/jobCatalogStats";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ templateId: string }> },
) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { templateId } = await ctx.params;
  const template = await getJobCatalogTemplateDetail(decodeURIComponent(templateId));
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ template });
}
