import type { MtilJobDefinition } from "./types";

/** Excel / CSV workbook columns for MTIL job import (v0.2). */
export const MTIL_JOB_WORKBOOK_COLUMNS = [
  { key: "jobId", header: "Job ID", required: true },
  { key: "mtilJobCode", header: "MTIL Internal Code", required: true },
  { key: "phase", header: "Phase", required: true, type: "number" },
  { key: "department", header: "Department", required: true },
  { key: "systemCode", header: "System Code", required: true },
  { key: "systemName", header: "System Name", required: true },
  { key: "machineryCode", header: "Machinery Code", required: true },
  { key: "machineryName", header: "Machinery Name", required: true },
  { key: "componentCode", header: "Component Code", required: true },
  { key: "componentName", header: "Component Name", required: true },
  { key: "subComponent", header: "Sub Component", required: false },
  { key: "action", header: "Action", required: true },
  { key: "title", header: "Standard Job Name", required: true },
  { key: "description", header: "Description", required: false },
  { key: "workshop", header: "Workshop", required: true },
  { key: "templateId", header: "Dynamic Template ID", required: true },
  { key: "dynamicTemplateKey", header: "Dynamic Template Key", required: true },
  { key: "vesselTypeApplicability", header: "Vessel Type Applicability", required: false },
  { key: "projectTypeApplicability", header: "Project Type Applicability", required: false },
  { key: "defaultPriority", header: "Priority", required: true },
  { key: "estimatedManhours", header: "Est. Manhours", required: true, type: "number" },
  { key: "referenceCode", header: "Reference Code", required: false },
  { key: "classHoldPoint", header: "Class Hold Point", required: false, type: "boolean" },
  { key: "qaQcHoldPoint", header: "QA/QC Hold Point", required: false, type: "boolean" },
  { key: "permitRequired", header: "Permit Required", required: false, type: "boolean" },
  { key: "responsibleUser", header: "Responsible User", required: false },
  { key: "approvalWorkflow", header: "Approval Workflow", required: false },
  { key: "requiredAttachments", header: "Required Attachments", required: false },
  { key: "requiredPhotos", header: "Required Photos", required: false },
  { key: "requiredReports", header: "Required Reports", required: false },
  { key: "measurementRefs", header: "Required Measurements", required: false },
  { key: "checklistRefs", header: "Inspection Checklists", required: false },
  { key: "rfqCategory", header: "RFQ Category", required: false },
  { key: "budgetCategory", header: "Budget Category", required: false },
  { key: "costCode", header: "Budget Code", required: false },
] as const;

export const MTIL_TEMPLATE_WORKBOOK_COLUMNS = [
  { key: "templateId", header: "Template ID", required: true },
  { key: "key", header: "Template Key", required: true },
  { key: "label", header: "Template Name", required: true },
  { key: "classHoldPoint", header: "Class Hold Point", required: false },
  { key: "qaQcRequired", header: "QA/QC Required", required: false },
  { key: "permitRequired", header: "Permit Required", required: false },
  { key: "photoSlots", header: "Photo Slots", required: false },
  { key: "measurementRefs", header: "Measurements", required: false },
  { key: "checklistRefs", header: "Checklists", required: false },
  { key: "approvalWorkflow", header: "Approval Workflow", required: false },
] as const;

export const MTIL_MEASUREMENT_WORKBOOK_COLUMNS = [
  { key: "measurementId", header: "Measurement ID", required: true },
  { key: "code", header: "Code", required: true },
  { key: "label", header: "Label", required: true },
  { key: "unit", header: "Unit", required: true },
  { key: "min", header: "Min", required: false },
  { key: "max", header: "Max", required: false },
  { key: "tolerance", header: "Tolerance", required: false },
  { key: "required", header: "Required", required: false },
] as const;

export const MTIL_CHECKLIST_WORKBOOK_COLUMNS = [
  { key: "checklistKey", header: "Checklist Key", required: true },
  { key: "inspectionId", header: "Inspection ID", required: true },
  { key: "code", header: "Item Code", required: true },
  { key: "label", header: "Item Label", required: true },
  { key: "holdPoint", header: "Hold Point", required: false },
  { key: "classRequired", header: "Class Required", required: false },
  { key: "qaQcRequired", header: "QA/QC Required", required: false },
] as const;

export const MTIL_SCOPE_WORKBOOK_COLUMNS = [
  { key: "scopeStepId", header: "Scope Step ID", required: true },
  { key: "scopeOfWorkId", header: "Scope of Work ID", required: true },
  { key: "templateId", header: "Template ID", required: true },
  { key: "sequenceNo", header: "Sequence", required: true },
  { key: "workStep", header: "Work Step", required: true },
  { key: "responsibleParty", header: "Responsible Party", required: true },
  { key: "permitRequired", header: "Permit Required", required: false },
  { key: "qaHoldPoint", header: "QA Hold Point", required: false },
  { key: "classHoldPoint", header: "Class Hold Point", required: false },
] as const;

export const MTIL_SPARES_WORKBOOK_COLUMNS = [
  { key: "spareMapId", header: "Spare Map ID", required: true },
  { key: "jobId", header: "Job ID", required: true },
  { key: "templateId", header: "Template ID", required: true },
  { key: "itemType", header: "Item Type", required: true },
  { key: "itemName", header: "Item Name", required: true },
  { key: "quantityBasis", header: "Quantity Basis", required: true },
  { key: "recommendedQty", header: "Recommended Qty", required: false },
  { key: "ownerSupplyFlag", header: "Owner Supply", required: false },
  { key: "yardSupplyFlag", header: "Yard Supply", required: false },
] as const;

export type MtilWorkbookColumnKey = (typeof MTIL_JOB_WORKBOOK_COLUMNS)[number]["key"];

function csvEscape(v: string): string {
  return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsvRow(cols: readonly { key: string }[], row: Record<string, unknown>): string {
  return cols
    .map((c) => {
      const v = row[c.key];
      if (v == null) return "";
      if (Array.isArray(v)) return csvEscape(v.join("; "));
      return csvEscape(String(v));
    })
    .join(",");
}

export function jobDefinitionToWorkbookRow(job: MtilJobDefinition): Record<string, unknown> {
  const templateDef = job.dynamicTemplateKey;
  return {
    jobId: job.jobId,
    mtilJobCode: job.mtilJobCode,
    phase: job.phase,
    department: job.department,
    systemCode: job.systemCode,
    systemName: job.systemName,
    machineryCode: job.machineryCode,
    machineryName: job.machineryName,
    componentCode: job.componentCode,
    componentName: job.componentName,
    subComponent: job.subComponent ?? "",
    action: job.action,
    title: job.title,
    description: job.description ?? "",
    workshop: job.workshop,
    templateId: job.templateId,
    dynamicTemplateKey: templateDef,
    vesselTypeApplicability: job.vesselTypeApplicability,
    projectTypeApplicability: job.projectTypeApplicability,
    defaultPriority: job.defaultPriority,
    estimatedManhours: job.estimatedManhours,
    referenceCode: job.referenceCode ?? "",
    classHoldPoint: job.classHoldPoint ?? false,
    qaQcHoldPoint: job.qaQcHoldPoint ?? false,
    permitRequired: job.permitRequired ?? false,
    responsibleUser: job.responsibleUser ?? "Chief Engineer",
    approvalWorkflow: job.approvalWorkflow ?? [],
    requiredAttachments: job.requiredAttachments ?? [],
    requiredPhotos: job.requiredPhotos ?? [],
    requiredReports: job.requiredReports ?? [],
    measurementRefs: (job.measurementRefs ?? []).join(","),
    checklistRefs: (job.checklistRefs ?? []).join(","),
    rfqCategory: job.rfqMapping?.rfqCategory ?? "",
    budgetCategory: job.budgetMapping?.budgetCategory ?? "",
    costCode: job.budgetMapping?.costCode ?? "",
  };
}

export function mtilWorkbookCsvHeader(): string {
  return MTIL_JOB_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
}

export function mtilWorkbookCsvRow(job: MtilJobDefinition): string {
  return toCsvRow(MTIL_JOB_WORKBOOK_COLUMNS, jobDefinitionToWorkbookRow(job));
}

export function mtilTemplateWorkbookCsv(templates: Array<Record<string, unknown>>): string {
  const header = MTIL_TEMPLATE_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
  const rows = templates.map((t) => toCsvRow(MTIL_TEMPLATE_WORKBOOK_COLUMNS, t));
  return [header, ...rows].join("\n");
}

export function mtilMeasurementWorkbookCsv(measurements: Array<Record<string, unknown>>): string {
  const header = MTIL_MEASUREMENT_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
  const rows = measurements.map((m) => toCsvRow(MTIL_MEASUREMENT_WORKBOOK_COLUMNS, m));
  return [header, ...rows].join("\n");
}

export function mtilChecklistWorkbookCsv(items: Array<Record<string, unknown>>): string {
  const header = MTIL_CHECKLIST_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
  const rows = items.map((i) => toCsvRow(MTIL_CHECKLIST_WORKBOOK_COLUMNS, i));
  return [header, ...rows].join("\n");
}

export function mtilScopeWorkbookCsv(steps: Array<Record<string, unknown>>): string {
  const header = MTIL_SCOPE_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
  const rows = steps.map((s) => toCsvRow(MTIL_SCOPE_WORKBOOK_COLUMNS, s));
  return [header, ...rows].join("\n");
}

export function mtilSparesWorkbookCsv(spares: Array<Record<string, unknown>>): string {
  const header = MTIL_SPARES_WORKBOOK_COLUMNS.map((c) => c.header).join(",");
  const rows = spares.map((s) => toCsvRow(MTIL_SPARES_WORKBOOK_COLUMNS, s));
  return [header, ...rows].join("\n");
}
