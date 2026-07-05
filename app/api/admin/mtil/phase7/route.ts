import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getPhase7WorkbookV10Stats } from "@/lib/mtil/phases/phase7/workbookJobLibraryTree";
import {
  loadPhase7WorkbookV10,
  PHASE7_WORKBOOK_V10_FILENAME,
} from "@/lib/mtil/phases/phase7/workbookV10";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import { ensureMtilPhase7WorkbookV10Seeded } from "@/lib/vessel/jobLibrary/seed";

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
    const data = loadPhase7WorkbookV10();
    if (data.initializedOnly && data.masterJobs.length === 0) {
      return NextResponse.json(
        {
          error: "Phase 7 workbook is initialized only — no job rows to export yet.",
          initializedOnly: true,
          libraryVersion: data.libraryVersion,
        },
        { status: 404 },
      );
    }
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 7,
      department: "Cargo & Tank Systems",
      systemCode: "CGO_V10",
      filenamePrefix: "mtil-phase7-v10",
    });
    return csvResponse(body, filename);
  }

  const workbookV10 = getPhase7WorkbookV10Stats();
  return NextResponse.json({
    workbookV10,
    workbookFile: PHASE7_WORKBOOK_V10_FILENAME,
    combinedJobCount: workbookV10.jobCount,
    initializedOnly: workbookV10.initializedOnly,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilPhase7WorkbookV10Seeded();
  return NextResponse.json({ workbookV10: result }, { status: result.inserted ? 201 : 200 });
}
