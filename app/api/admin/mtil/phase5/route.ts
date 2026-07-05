import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getPhase5WorkbookV08Stats } from "@/lib/mtil/phases/phase5/workbookJobLibraryTree";
import {
  loadPhase5WorkbookV08,
  PHASE5_WORKBOOK_V08_FILENAME,
} from "@/lib/mtil/phases/phase5/workbookV08";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import { ensureMtilPhase5WorkbookV08Seeded } from "@/lib/vessel/jobLibrary/seed";

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
    const data = loadPhase5WorkbookV08();
    if (data.initializedOnly && data.masterJobs.length === 0) {
      return NextResponse.json(
        {
          error: "Phase 5 workbook is initialized only — no job rows to export yet.",
          initializedOnly: true,
          libraryVersion: data.libraryVersion,
        },
        { status: 404 },
      );
    }
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 5,
      department: "Hull, Steel & Coatings",
      systemCode: "HUL_V08",
      filenamePrefix: "mtil-phase5-v08",
    });
    return csvResponse(body, filename);
  }

  const workbookV08 = getPhase5WorkbookV08Stats();
  return NextResponse.json({
    workbookV08,
    workbookFile: PHASE5_WORKBOOK_V08_FILENAME,
    combinedJobCount: workbookV08.jobCount,
    initializedOnly: workbookV08.initializedOnly,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilPhase5WorkbookV08Seeded();
  return NextResponse.json({ workbookV08: result }, { status: result.inserted ? 201 : 200 });
}
