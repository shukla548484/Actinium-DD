import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { generatePhase1JobDefinitions, getPhase1Stats } from "@/lib/mtil/phases/phase1/generate";
import { getPhase1WorkbookV04Stats } from "@/lib/mtil/phases/phase1/workbookJobLibraryTree";
import {
  loadPhase1WorkbookV04,
  PHASE1_WORKBOOK_V04_FILENAME,
} from "@/lib/mtil/phases/phase1/workbookV04";
import { getPhase1TemplateCatalog, getAllPhase1Templates } from "@/lib/mtil/phases/phase1/templateCatalog";
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
import { listPhase1Measurements } from "@/lib/mtil/measurementLibrary";
import { MTIL_PHASE1_CHECKLISTS } from "@/lib/mtil/checklistLibrary";
import {
  ensureMtilPhase1Seeded,
  ensureMtilPhase1WorkbookV04Seeded,
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

  if (format === "csv" && source === "v04") {
    const data = loadPhase1WorkbookV04();
    const { body, filename } = workbookCsvResponse(data, sheet, {
      phase: 1,
      department: "Main Propulsion",
      systemCode: "ME_V04",
      filenamePrefix: "mtil-phase1-v04",
    });
    return csvResponse(body, filename);
  }

  if (format === "csv") {
    if (sheet === "templates") {
      const rows = getPhase1TemplateCatalog().map((t) => ({
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
      return csvResponse(mtilTemplateWorkbookCsv(rows), "mtil-phase1-matrix-templates.csv");
    }

    if (sheet === "measurements") {
      const rows = listPhase1Measurements().map((m) => ({
        measurementId: m.measurementId,
        code: m.code,
        label: m.label,
        unit: m.unit,
        min: m.min ?? "",
        max: m.max ?? "",
        tolerance: m.tolerance ?? "",
        required: m.required ?? false,
      }));
      return csvResponse(mtilMeasurementWorkbookCsv(rows), "mtil-phase1-matrix-measurements.csv");
    }

    if (sheet === "checklists") {
      const rows = Object.entries(MTIL_PHASE1_CHECKLISTS).flatMap(([checklistKey, items]) =>
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
      return csvResponse(mtilChecklistWorkbookCsv(rows), "mtil-phase1-matrix-checklists.csv");
    }

    if (sheet === "scope") {
      const rows = getAllPhase1Templates().flatMap((t) => buildScopeStepRows(t));
      return csvResponse(mtilScopeWorkbookCsv(rows), "mtil-phase1-matrix-scope.csv");
    }

    if (sheet === "spares") {
      const rows = generatePhase1JobDefinitions().flatMap((j) => buildSpareMappingRows(j));
      return csvResponse(mtilSparesWorkbookCsv(rows), "mtil-phase1-matrix-spares.csv");
    }

    const jobs = generatePhase1JobDefinitions();
    const lines = [mtilWorkbookCsvHeader(), ...jobs.map(mtilWorkbookCsvRow)];
    return csvResponse(lines.join("\n"), "mtil-phase1-matrix-jobs.csv");
  }

  const matrix = getPhase1Stats();
  const workbookV04 = getPhase1WorkbookV04Stats();
  return NextResponse.json({
    matrix,
    workbookV04,
    workbookFile: PHASE1_WORKBOOK_V04_FILENAME,
    combinedJobCount: matrix.jobCount + workbookV04.jobCount,
  });
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (source === "v04") {
    const result = await ensureMtilPhase1WorkbookV04Seeded();
    return NextResponse.json(result, { status: result.inserted ? 201 : 200 });
  }

  if (source === "all") {
    const [matrix, workbookV04] = await Promise.all([
      ensureMtilPhase1Seeded(),
      ensureMtilPhase1WorkbookV04Seeded(),
    ]);
    return NextResponse.json({ matrix, workbookV04 }, { status: 201 });
  }

  const matrix = await ensureMtilPhase1Seeded();
  const workbookV04 = await ensureMtilPhase1WorkbookV04Seeded();
  return NextResponse.json({ matrix, workbookV04 }, { status: matrix.inserted ? 201 : 200 });
}
