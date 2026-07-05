import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { generatePhase3JobDefinitions, getPhase3Stats } from "@/lib/mtil/phases/phase3/generate";
import { getPhase3WorkbookV06Stats } from "@/lib/mtil/phases/phase3/workbookJobLibraryTree";
import {
  loadPhase3WorkbookV06,
  PHASE3_WORKBOOK_V06_FILENAME,
} from "@/lib/mtil/phases/phase3/workbookV06";
import { getPhase3TemplateCatalog, getAllPhase3Templates } from "@/lib/mtil/phases/phase3/templateCatalog";
import { workbookCsvResponse } from "@/lib/mtil/phases/shared/workbookCsvExport";
import {
  mtilWorkbookCsvHeader,
  mtilWorkbookCsvRow,
  mtilTemplateWorkbookCsv,
  mtilMeasurementWorkbookCsv,
  mtilChecklistWorkbookCsv,
  mtilScopeWorkbookCsv,
  mtilSparesWorkbookCsv,
} from "@/lib/mtil/workbookSchema";
import { buildScopeStepRows, buildSpareMappingRows } from "@/lib/mtil/db/mapToJobCatalog";
import { listPhase3Measurements } from "@/lib/mtil/measurementLibrary";
import { MTIL_PHASE3_CHECKLISTS } from "@/lib/mtil/checklistLibrary";
import {
  ensureMtilPhase3Seeded,
  ensureMtilPhase3WorkbookV06Seeded,
} from "@/lib/vessel/jobLibrary/seed";

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
  const source = searchParams.get("source") ?? "matrix";

  if (format === "csv" && source === "v06") {
    const data = loadPhase3WorkbookV06();
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 3,
      department: "Pumps, Valves & Piping",
      systemCode: "PVP_V06",
      filenamePrefix: "mtil-phase3-v06",
    });
    return csvResponse(body, filename);
  }

  if (format === "csv") {
    if (sheet === "templates") {
      const rows = getPhase3TemplateCatalog().map((t) => ({
        templateId: t.templateId,
        key: t.key,
        label: t.label,
        classHoldPoint: t.classHoldPoint ?? false,
        qaQcRequired: t.qaQcRequired ?? false,
        permitRequired: t.permitRequired ?? false,
        photoSlots: t.photoSlots ?? [],
        measurementRefs: t.measurementRefs ?? [],
        checklistRefs: t.checklistRefs ?? [],
        approvalWorkflow: t.approvalWorkflow ?? [],
      }));
      return csvResponse(mtilTemplateWorkbookCsv(rows), "mtil-phase3-matrix-templates.csv");
    }

    if (sheet === "measurements") {
      const rows = listPhase3Measurements().map((m) => ({
        measurementId: m.measurementId,
        code: m.code,
        label: m.label,
        unit: m.unit,
        min: m.min ?? "",
        max: m.max ?? "",
        tolerance: m.tolerance ?? "",
        required: m.required ?? false,
      }));
      return csvResponse(mtilMeasurementWorkbookCsv(rows), "mtil-phase3-matrix-measurements.csv");
    }

    if (sheet === "checklists") {
      const rows = Object.entries(MTIL_PHASE3_CHECKLISTS).flatMap(([checklistKey, items]) =>
        items.map((item) => ({
          checklistKey,
          inspectionId: item.inspectionId,
          code: item.code,
          label: item.label,
          holdPoint: item.holdPoint ?? false,
          classRequired: item.classRequired ?? false,
          qaQcRequired: item.qaQcRequired ?? false,
        })),
      );
      return csvResponse(mtilChecklistWorkbookCsv(rows), "mtil-phase3-matrix-checklists.csv");
    }

    if (sheet === "scope") {
      const rows = getAllPhase3Templates().flatMap((t) => buildScopeStepRows(t));
      return csvResponse(mtilScopeWorkbookCsv(rows), "mtil-phase3-matrix-scope.csv");
    }

    if (sheet === "spares") {
      const rows = generatePhase3JobDefinitions().flatMap((j) => buildSpareMappingRows(j));
      return csvResponse(mtilSparesWorkbookCsv(rows), "mtil-phase3-matrix-spares.csv");
    }

    const jobs = generatePhase3JobDefinitions();
    const lines = [mtilWorkbookCsvHeader(), ...jobs.map(mtilWorkbookCsvRow)];
    return csvResponse(lines.join("\n"), "mtil-phase3-matrix-jobs.csv");
  }

  const matrix = getPhase3Stats();
  const workbookV06 = getPhase3WorkbookV06Stats();
  return NextResponse.json({
    matrix,
    workbookV06,
    workbookFile: PHASE3_WORKBOOK_V06_FILENAME,
    combinedJobCount: matrix.jobCount + workbookV06.jobCount,
  });
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (source === "v06") {
    const result = await ensureMtilPhase3WorkbookV06Seeded();
    return NextResponse.json(result, { status: result.inserted ? 201 : 200 });
  }

  if (source === "all") {
    const [matrix, workbookV06] = await Promise.all([
      ensureMtilPhase3Seeded(),
      ensureMtilPhase3WorkbookV06Seeded(),
    ]);
    return NextResponse.json({ matrix, workbookV06 }, { status: 201 });
  }

  const matrix = await ensureMtilPhase3Seeded();
  const workbookV06 = await ensureMtilPhase3WorkbookV06Seeded();
  return NextResponse.json({ matrix, workbookV06 }, { status: matrix.inserted ? 201 : 200 });
}
