import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { MTIL_V2_JOB_FIELD_COUNT } from "@/lib/mtil/v2/jobSchema";
import { getMtilV2ProgressReport } from "@/lib/mtil/v2/progress";
import { getV2DomainByRelease } from "@/lib/mtil/v2/registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const release = searchParams.get("release");

  if (release) {
    const domain = getV2DomainByRelease(release);
    if (!domain) {
      return NextResponse.json({ error: `Unknown V2.0 release: ${release}` }, { status: 404 });
    }
    const progress = getMtilV2ProgressReport();
    const domainProgress = progress.domains.find((d) => d.release === release);
    return NextResponse.json({
      domain,
      progress: domainProgress,
      jobAttributeCount: MTIL_V2_JOB_FIELD_COUNT,
      deliverables: progress.deliverables,
    });
  }

  return NextResponse.json({ v2: getMtilV2ProgressReport() });
}
