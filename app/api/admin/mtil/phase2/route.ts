import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { generatePhase2JobDefinitions, getPhase2Stats } from "@/lib/mtil/phases/phase2/generate";
import { getPhase2WorkbookV05Stats } from "@/lib/mtil/phases/phase2/workbookJobLibraryTree";
import { loadPhase2WorkbookV05, PHASE2_WORKBOOK_V05_FILENAME } from "@/lib/mtil/phases/phase2/workbookV05";
import { getPhase2TemplateCatalog, getAllPhase2Templates } from "@/lib/mtil/phases/phase2/templateCatalog";
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
import { listPhase2Measurements } from "@/lib/mtil/measurementLibrary";
import { MTIL_PHASE2_CHECKLISTS } from "@/lib/mtil/checklistLibrary";
import { ensureMtilPhase2Seeded, ensureMtilPhase2WorkbookV05Seeded } from "@/lib/vessel/jobLibrary/seed";
import { templateIdToKey } from "@/lib/mtil/phases/phase2/workbookV05";

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

  if (format === "csv" && source === "v05") {
    const data = loadPhase2WorkbookV05();

    if (sheet === "templates") {
      const rows = data.templates.map((t) => ({
        templateId: t.templateId,
        key: templateIdToKey(t.templateId),
        label: t.templateName,
        classHoldPoint: data.workflows.some((w) => w.templateId === t.templateId && w.classApprovalRequired),
        qaQcRequired: false,
        permitRequired: false,
        photoSlots: t.requiredPhotos.map((p) => p.label),
        measurementRefs: t.measurementSetId ? [t.measurementSetId] : [],
        checklistRefs: t.checklistId ? [t.checklistId] : [],
        approvalWorkflow: [t.approvalWorkflowId],
      }));
      return csvResponse(mtilTemplateWorkbookCsv(rows), "mtil-phase2-v05-templates.csv");
    }

    if (sheet === "measurements") {
      const rows = data.measurements.map((m) => ({
        measurementId: m.measurementId,
        code: m.measurementId,
        label: m.measurementName,
        unit: m.unit,
        min: m.minLimit ?? "",
        max: m.maxLimit ?? "",
        tolerance: m.targetValue ?? "",
        required: m.mandatoryFlag,
      }));
      return csvResponse(mtilMeasurementWorkbookCsv(rows), "mtil-phase2-v05-measurements.csv");
    }

    if (sheet === "checklists") {
      const byChecklist = new Map<string, typeof data.checklistItems>();
      for (const item of data.checklistItems) {
        const list = byChecklist.get(item.checklistId) ?? [];
        list.push(item);
        byChecklist.set(item.checklistId, list);
      }
      const rows = [...byChecklist.entries()].flatMap(([checklistKey, items]) =>
        items.map((item) => ({
          checklistKey,
          inspectionId: item.checklistItemId,
          code: item.checklistItemId,
          label: item.inspectionItem,
          holdPoint: item.mandatoryFlag,
          classRequired: false,
          qaQcRequired: false,
        })),
      );
      return csvResponse(mtilChecklistWorkbookCsv(rows), "mtil-phase2-v05-checklists.csv");
    }

    if (sheet === "scope") {
      const rows = data.scopeSteps.map((s) => ({
        scopeStepId: s.scopeStepId,
        scopeOfWorkId: s.scopeOfWorkId,
        templateId: s.templateId,
        sequenceNo: s.sequenceNo,
        workStep: s.workStep,
        responsibleParty: s.responsibleParty,
        permitRequired: s.permitRequired ?? "",
        qaHoldPoint: s.qaHoldPoint,
        classHoldPoint: s.classHoldPoint,
      }));
      return csvResponse(mtilScopeWorkbookCsv(rows), "mtil-phase2-v05-scope.csv");
    }

    if (sheet === "spares") {
      const rows = data.spares.map((s) => ({
        spareMapId: s.spareMapId,
        jobId: s.jobId,
        templateId: s.templateId,
        itemType: s.itemType,
        itemName: s.itemName,
        quantityBasis: s.quantityBasis,
        recommendedQty: s.recommendedQty ?? 1,
        ownerSupplyFlag: s.ownerSupplyFlag,
        yardSupplyFlag: s.yardSupplyFlag,
        remarks: s.remarks ?? "",
      }));
      return csvResponse(mtilSparesWorkbookCsv(rows), "mtil-phase2-v05-spares.csv");
    }

    const lines = [
      mtilWorkbookCsvHeader(),
      ...data.masterJobs.map((j) =>
        mtilWorkbookCsvRow({
          jobId: j.jobId,
          mtilJobCode: j.jobId,
          phase: 2,
          department: "Auxiliary Machinery",
          systemCode: "AUX_V05",
          systemName: j.systemGroup,
          machineryCode: j.machinery.slice(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, "_"),
          machineryName: j.machinery,
          componentCode: j.component.slice(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, "_"),
          componentName: j.component,
          subComponent: j.subComponent ?? j.component,
          action: "inspect",
          title: j.standardJobName,
          description: j.jobDescription,
          workshop: j.workshop === "machinery" ? "Machinery" : j.workshop,
          templateId: j.templateId,
          dynamicTemplateKey: templateIdToKey(j.templateId),
          vesselTypeApplicability: j.applicableVesselTypes,
          projectTypeApplicability: [],
          defaultPriority: j.riskLevel === "critical" ? "critical" : j.riskLevel === "high" ? "high" : "medium",
          estimatedManhours: j.standardManHours ?? 8,
          referenceCode: j.jobId,
          classHoldPoint: j.classHoldPoint,
          qaQcHoldPoint: false,
          permitRequired: j.permitRequired.length > 0,
          responsibleUser: j.responsibleUserRole,
          approvalWorkflow: [],
          requiredAttachments: [],
          requiredPhotos: j.photoRequired ? ["before", "after"] : [],
          requiredReports: [],
          rfqMapping: { rfqCategory: j.rfqCategory, lineDescription: j.standardJobName },
          budgetMapping: { budgetCategory: j.budgetCategory, costCode: j.dryDockCostCode },
        }),
      ),
    ];
    return csvResponse(lines.join("\n"), "mtil-phase2-v05-jobs.csv");
  }

  if (format === "csv") {
    if (sheet === "templates") {
      const rows = getPhase2TemplateCatalog().map((t) => ({
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
      return csvResponse(mtilTemplateWorkbookCsv(rows), "mtil-phase2-matrix-templates.csv");
    }

    if (sheet === "measurements") {
      const rows = listPhase2Measurements().map((m) => ({
        measurementId: m.measurementId,
        code: m.code,
        label: m.label,
        unit: m.unit,
        min: m.min ?? "",
        max: m.max ?? "",
        tolerance: m.tolerance ?? "",
        required: m.required ?? false,
      }));
      return csvResponse(mtilMeasurementWorkbookCsv(rows), "mtil-phase2-matrix-measurements.csv");
    }

    if (sheet === "checklists") {
      const rows = Object.entries(MTIL_PHASE2_CHECKLISTS).flatMap(([checklistKey, items]) =>
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
      return csvResponse(mtilChecklistWorkbookCsv(rows), "mtil-phase2-matrix-checklists.csv");
    }

    if (sheet === "scope") {
      const rows = getAllPhase2Templates().flatMap((t) => buildScopeStepRows(t));
      return csvResponse(mtilScopeWorkbookCsv(rows), "mtil-phase2-matrix-scope.csv");
    }

    if (sheet === "spares") {
      const rows = generatePhase2JobDefinitions().flatMap((j) => buildSpareMappingRows(j));
      return csvResponse(mtilSparesWorkbookCsv(rows), "mtil-phase2-matrix-spares.csv");
    }

    const jobs = generatePhase2JobDefinitions();
    const lines = [mtilWorkbookCsvHeader(), ...jobs.map(mtilWorkbookCsvRow)];
    return csvResponse(lines.join("\n"), "mtil-phase2-matrix-jobs.csv");
  }

  return NextResponse.json({
    matrix: getPhase2Stats(),
    workbookV05: getPhase2WorkbookV05Stats(),
    workbookFile: PHASE2_WORKBOOK_V05_FILENAME,
    combinedJobCount: getPhase2Stats().jobCount + getPhase2WorkbookV05Stats().jobCount,
  });
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");

  if (source === "v05") {
    const result = await ensureMtilPhase2WorkbookV05Seeded();
    return NextResponse.json(result, { status: result.inserted ? 201 : 200 });
  }

  if (source === "all") {
    const [matrix, workbook] = await Promise.all([
      ensureMtilPhase2Seeded(),
      ensureMtilPhase2WorkbookV05Seeded(),
    ]);
    return NextResponse.json({ matrix, workbookV05: workbook }, { status: 201 });
  }

  const result = await ensureMtilPhase2Seeded();
  const workbook = await ensureMtilPhase2WorkbookV05Seeded();
  return NextResponse.json({ matrix: result, workbookV05: workbook }, { status: result.inserted ? 201 : 200 });
}
