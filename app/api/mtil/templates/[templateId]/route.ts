import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getMtilTemplateDetail } from "@/lib/db/mtilJobs";
import { resolveTemplateFromDb } from "@/lib/mtil/db/resolveTemplate";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { templateId } = await context.params;
  const template = await getMtilTemplateDetail(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const runtimeFields = await resolveTemplateFromDb(templateId);

  return NextResponse.json({
    template,
    runtimeFields,
  });
}
