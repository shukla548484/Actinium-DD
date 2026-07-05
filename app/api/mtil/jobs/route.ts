import { NextResponse } from "next/server";
import type { DryDockProjectType } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { listMtilMasterJobs } from "@/lib/db/mtilJobs";

export const runtime = "nodejs";

const PROJECT_TYPES = new Set<string>([
  "special_survey",
  "intermediate_survey",
  "damage_repair",
  "occasional_repair",
  "underwater_survey",
  "new_installation",
  "emergency_docking",
  "layup_reactivation",
  "conversion_modification",
  "warranty_repair",
]);

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const machinery = searchParams.get("machinery") ?? undefined;
  const component = searchParams.get("component") ?? undefined;
  const templateId = searchParams.get("templateId") ?? undefined;
  const vesselType = searchParams.get("vesselType") ?? undefined;
  const projectTypeRaw = searchParams.get("projectType");
  const projectType =
    projectTypeRaw && PROJECT_TYPES.has(projectTypeRaw)
      ? (projectTypeRaw as DryDockProjectType)
      : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 100) || 100, 500);
  const offset = Number(searchParams.get("offset") ?? 0) || 0;

  const result = await listMtilMasterJobs({
    machinery,
    component,
    templateId,
    vesselType,
    projectType,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
