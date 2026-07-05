import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { masterRepositoryCsvResponse } from "@/lib/mtil/master/masterCsvExport";
import { getMasterRepositoryV12Stats } from "@/lib/mtil/master/repositoryJobLibraryTree";
import {
  loadMasterRepositoryV12,
  MASTER_REPOSITORY_V12_FILENAME,
} from "@/lib/mtil/master/repositoryV12";
import { ensureMtilMasterRepositoryV12Seeded } from "@/lib/vessel/jobLibrary/seed";

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
  const sheet = searchParams.get("sheet") ?? "dashboard";

  if (format === "csv") {
    const data = loadMasterRepositoryV12();
    if (data.frameworkAreaCount === 0) {
      return NextResponse.json(
        {
          error: "Master repository workbook not found or empty.",
          frameworkOnly: true,
        },
        { status: 404 },
      );
    }
    try {
      const { body, filename } = masterRepositoryCsvResponse(data, sheet);
      return csvResponse(body, filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV export failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const masterRepoV12 = getMasterRepositoryV12Stats();
  return NextResponse.json({
    masterRepoV12,
    workbookFile: MASTER_REPOSITORY_V12_FILENAME,
    combinedJobCount: masterRepoV12.jobCount,
    frameworkOnly: masterRepoV12.frameworkOnly,
    initializedOnly: masterRepoV12.initializedOnly,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const result = await ensureMtilMasterRepositoryV12Seeded();
  return NextResponse.json({ masterRepoV12: result }, { status: result.inserted ? 201 : 200 });
}
