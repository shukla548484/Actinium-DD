import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  DRY_DOCK_PROJECT_TYPES,
  getProjectTemplate,
  listProjectTemplates,
} from "@/lib/superintendent/engine";
import type { DryDockProjectType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const type = new URL(request.url).searchParams.get("type") as DryDockProjectType | null;

  if (type) {
    const template = getProjectTemplate(type);
    const meta = DRY_DOCK_PROJECT_TYPES.find((t) => t.type === type);
    return NextResponse.json({
      meta,
      template: {
        modules: template.modules,
        jobCount: template.jobs.length,
        checklistCount: template.checklist.length,
        milestoneCount: template.milestones.length,
        jobs: template.jobs.map((j) => j.title),
      },
    });
  }

  return NextResponse.json({
    types: DRY_DOCK_PROJECT_TYPES,
    templates: listProjectTemplates().map((t) => ({
      type: t.type,
      version: t.version,
      modules: t.modules,
      jobCount: t.jobs.length,
      checklistCount: t.checklist.length,
      milestoneCount: t.milestones.length,
    })),
  });
}
