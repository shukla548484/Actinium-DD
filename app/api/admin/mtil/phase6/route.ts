import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getPhase6WorkbookV09Stats } from "@/lib/mtil/phases/phase6/workbookJobLibraryTree";
import {
  loadPhase6WorkbookV09,
  PHASE6_WORKBOOK_V09_FILENAME,
} from "@/lib/mtil/phases/phase6/workbookV09";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import { ensureMtilPhase6WorkbookV09Seeded } from "@/lib/vessel/jobLibrary/seed";

export const runtime = "nodejs";

function csvResponse(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const sheet = searchParams.get("sheet") ?? "jobs";

  if (format === "csv") {
    const data = loadPhase6WorkbookV09();
    if (data.initializedOnly && data.masterJobs.length === 0) {
      return NextResponse.json(
        {
          error: "Phase 6 workbook is initialized only — no job rows to export yet.",
          initializedOnly: true,
          libraryVersion: data.libraryVersion,
        },
        { status: 404 },
      );
    }
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 6,
      department: "Electrical, Automation & Navigation",
      systemCode: "ELC_V09",
      filenamePrefix: "mtil-phase6-v09",
    });
    return csvResponse(body, filename);
  }

  const workbookV09 = getPhase6WorkbookV09Stats();
  return NextResponse.json({
    workbookV09,
    workbookFile: PHASE6_WORKBOOK_V09_FILENAME,
    combinedJobCount: workbookV09.jobCount,
    initializedOnly: workbookV09.initializedOnly,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilPhase6WorkbookV09Seeded();
  return NextResponse.json({ workbookV09: result }, { status: result.inserted ? 201 : 200 });
}
