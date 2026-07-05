import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getPhase4WorkbookV07Stats } from "@/lib/mtil/phases/phase4/workbookJobLibraryTree";
import {
  loadPhase4WorkbookV07,
  PHASE4_WORKBOOK_V07_FILENAME,
} from "@/lib/mtil/phases/phase4/workbookV07";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import { ensureMtilPhase4WorkbookV07Seeded } from "@/lib/vessel/jobLibrary/seed";

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
    const data = loadPhase4WorkbookV07();
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 4,
      department: "Deck Machinery & Cargo",
      systemCode: "DECK_V07",
      filenamePrefix: "mtil-phase4-v07",
    });
    return csvResponse(body, filename);
  }

  const workbookV07 = getPhase4WorkbookV07Stats();
  return NextResponse.json({
    workbookV07,
    workbookFile: PHASE4_WORKBOOK_V07_FILENAME,
    combinedJobCount: workbookV07.jobCount,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilPhase4WorkbookV07Seeded();
  return NextResponse.json({ workbookV07: result }, { status: result.inserted ? 201 : 200 });
}
