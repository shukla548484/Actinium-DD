import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getPhase8WorkbookV11Stats } from "@/lib/mtil/phases/phase8/workbookJobLibraryTree";
import {
  loadPhase8WorkbookV11,
  PHASE8_WORKBOOK_V11_FILENAME,
} from "@/lib/mtil/phases/phase8/workbookV11";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import { ensureMtilPhase8WorkbookV11Seeded } from "@/lib/vessel/jobLibrary/seed";

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
    const data = loadPhase8WorkbookV11();
    if (data.initializedOnly && data.masterJobs.length === 0) {
      return NextResponse.json(
        {
          error: "Phase 8 workbook is initialized only — no job rows to export yet.",
          initializedOnly: true,
          libraryVersion: data.libraryVersion,
        },
        { status: 404 },
      );
    }
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 8,
      department: "Safety, LSA, FFA & Accommodation",
      systemCode: "SAF_V11",
      filenamePrefix: "mtil-phase8-v11",
    });
    return csvResponse(body, filename);
  }

  const workbookV11 = getPhase8WorkbookV11Stats();
  return NextResponse.json({
    workbookV11,
    workbookFile: PHASE8_WORKBOOK_V11_FILENAME,
    combinedJobCount: workbookV11.jobCount,
    initializedOnly: workbookV11.initializedOnly,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilPhase8WorkbookV11Seeded();
  return NextResponse.json({ workbookV11: result }, { status: result.inserted ? 201 : 200 });
}
