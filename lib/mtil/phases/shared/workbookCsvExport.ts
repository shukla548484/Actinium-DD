import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { MtilPhaseId } from "@/lib/mtil/types";
import {
  mtilChecklistWorkbookCsv,
  mtilMeasurementWorkbookCsv,
  mtilScopeWorkbookCsv,
  mtilSparesWorkbookCsv,
  mtilTemplateWorkbookCsv,
  mtilWorkbookCsvHeader,
  mtilWorkbookCsvRow,
} from "@/lib/mtil/workbookSchema";
import { templateIdToKey } from "./workbookUtils";

type WorkbookCsvOpts = {
  phase: MtilPhaseId;
  department: string;
  systemCode: string;
  filenamePrefix: string;
};

export function workbookCsvResponse(
  data: ParsedMtilWorkbook,
  sheet: string,
  opts: WorkbookCsvOpts,
): { body: string; filename: string } {
  const { phase, department, systemCode, filenamePrefix } = opts;

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
    return { body: mtilTemplateWorkbookCsv(rows), filename: `${filenamePrefix}-templates.csv` };
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
    return { body: mtilMeasurementWorkbookCsv(rows), filename: `${filenamePrefix}-measurements.csv` };
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
    return { body: mtilChecklistWorkbookCsv(rows), filename: `${filenamePrefix}-checklists.csv` };
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
    return { body: mtilScopeWorkbookCsv(rows), filename: `${filenamePrefix}-scope.csv` };
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
    return { body: mtilSparesWorkbookCsv(rows), filename: `${filenamePrefix}-spares.csv` };
  }

  const lines = [
    mtilWorkbookCsvHeader(),
    ...data.masterJobs.map((j) =>
      mtilWorkbookCsvRow({
        jobId: j.jobId,
        mtilJobCode: j.jobId,
        phase,
        department,
        systemCode,
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
  return { body: lines.join("\n"), filename: `${filenamePrefix}-jobs.csv` };
}
