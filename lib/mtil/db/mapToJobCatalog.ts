import type {
  DryDockProjectType,
  JobAttachmentStage,
  JobAttachmentType,
  JobCatalogDepartment,
  JobCatalogWorkshop,
  JobChecklistResponseType,
  JobMeasurementInputType,
  JobQuantityBasis,
  JobScopeResponsibleParty,
  JobSpareItemType,
  JobTemplateCategory,
  JobUiLayoutType,
} from "@prisma/client";
import type { MtilDynamicTemplateDef, MtilJobDefinition } from "@/lib/mtil/types";
import { resolveChecklist } from "@/lib/mtil/checklistLibrary";
import { resolveMeasurements } from "@/lib/mtil/measurementLibrary";
import { resolveSparesForJob } from "@/lib/mtil/sparesLibrary";
import { resolveDynamicTemplate } from "@/lib/mtil/dynamicTemplateEngine";
import { getPhase1TemplateByKey } from "@/lib/mtil/phases/phase1/templateCatalog";
import {
  AUTO_FILL_LABELS,
  PHOTO_SLOT_LABELS,
  STANDARD_FORM_SECTIONS,
  STANDARD_ME_APPROVAL_WORKFLOW_ID,
  type JobAutoFillFieldDef,
  type JobDynamicTemplatePayload,
  type JobManualInputFieldDef,
  type JobRequiredAttachmentDef,
  type JobRequiredPhotoDef,
} from "@/lib/jobCatalog/types";
import { MTIL_PROJECT_TYPES } from "@/lib/mtil/standards";

import {
  inspectionSetIdForTemplateId,
  measurementSetIdForTemplateId,
  scopeOfWorkIdForTemplateId,
} from "@/lib/mtil/masterCodeStandard";

export function measurementSetIdForTemplate(templateId: string): string {
  return measurementSetIdForTemplateId(templateId);
}

export function checklistIdForTemplate(templateId: string): string {
  return inspectionSetIdForTemplateId(templateId);
}

export function scopeOfWorkIdForTemplate(templateId: string): string {
  return scopeOfWorkIdForTemplateId(templateId);
}

export function inferTemplateCategory(key: string): JobTemplateCategory {
  if (key.includes("overhaul")) return "machinery_overhaul";
  if (key.includes("test") || key.includes("cal") || key.includes("trial") || key.includes("performance")) {
    return "testing";
  }
  if (key.includes("survey") || key.includes("inspect") || key.includes("bearing") || key.includes("deflection")) {
    return "inspection";
  }
  if (key.includes("5yr")) return "survey";
  if (key.includes("renew") || key.includes("repair")) return "repair";
  return "general";
}

export function inferUiLayout(key: string): JobUiLayoutType {
  if (key.includes("sea_trial") || key.includes("performance")) return "wizard";
  return "card_tabs";
}

function mapAutoFillFields(sources: string[] | undefined): JobAutoFillFieldDef[] {
  return (sources ?? []).map((key) => {
    const meta = AUTO_FILL_LABELS[key] ?? { label: key, source: "vessel" as const, path: key };
    return { key, label: meta.label, source: meta.source, path: meta.path };
  });
}

function mapManualFields(templateKey: string): JobManualInputFieldDef[] {
  const resolved = resolveDynamicTemplate(templateKey);
  const autoKeys = new Set([
    ...(getPhase1TemplateByKey(templateKey)?.autoFill ?? []).map((s) => {
      if (s === "machinery.runningHours") return "runningHours";
      if (s === "machinery.lastOverhaul") return "lastOverhaul";
      return s.split(".").pop()!;
    }),
  ]);

  return resolved
    .filter((f) => !autoKeys.has(f.key) && !f.key.startsWith("meas_"))
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      section: f.section ?? "condition",
      required: f.required,
      unit: f.unit,
      options: f.options,
    }));
}

function mapRequiredPhotos(slots: string[] | undefined): JobRequiredPhotoDef[] {
  return (slots ?? ["before", "after"]).map((slot) => ({
    slot,
    label: PHOTO_SLOT_LABELS[slot] ?? slot,
    mandatory: slot === "before" || slot === "after",
  }));
}

function mapRequiredAttachments(keys: string[] | undefined): JobRequiredAttachmentDef[] {
  return (keys ?? []).map((key) => ({
    key,
    label: key.replace(/_/g, " "),
    type: key.includes("permit") ? "certificate" : key.includes("risk") ? "report" : "manual",
    mandatory: key === "work_permit" || key === "risk_assessment",
  }));
}

/** Build tab-02 payload from MTIL template definition. */
export function buildDynamicTemplatePayload(def: MtilDynamicTemplateDef): JobDynamicTemplatePayload {
  const checklistRefs = def.checklistRefs ?? [];
  return {
    templateId: def.templateId,
    templateKey: def.key,
    templateName: def.label,
    formSections: STANDARD_FORM_SECTIONS,
    autoFillFields: mapAutoFillFields(def.autoFill),
    manualInputFields: mapManualFields(def.key),
    requiredPhotos: mapRequiredPhotos(def.photoSlots),
    requiredAttachments: mapRequiredAttachments(def.requiredAttachments),
    measurementSetId: def.measurementRefs?.length ? measurementSetIdForTemplate(def.templateId) : null,
    checklistId: checklistRefs.length ? checklistIdForTemplate(def.templateId) : null,
    approvalWorkflowId: STANDARD_ME_APPROVAL_WORKFLOW_ID,
  };
}

export function buildMeasurementRows(def: MtilDynamicTemplateDef) {
  if (!def.measurementRefs?.length) return [];
  const setId = measurementSetIdForTemplate(def.templateId);
  return resolveMeasurements(def.measurementRefs).map((m) => ({
    measurementId: m.measurementId,
    measurementSetId: setId,
    templateId: def.templateId,
    measurementName: m.label,
    unit: m.unit,
    minLimit: m.min ?? null,
    maxLimit: m.max ?? null,
    targetValue: m.tolerance ?? null,
    inputType: "number" as JobMeasurementInputType,
    mandatoryFlag: m.required ?? false,
    remarks: m.tolerance ?? null,
  }));
}

export function buildChecklistRows(def: MtilDynamicTemplateDef) {
  const checklistId = checklistIdForTemplate(def.templateId);
  const rows: Array<{
    checklistItemId: string;
    checklistId: string;
    templateId: string;
    sequenceNo: number;
    inspectionItem: string;
    acceptanceCriteria: string;
    responseType: JobChecklistResponseType;
    photoRequiredOnFail: boolean;
    mandatoryFlag: boolean;
  }> = [];

  let seq = 0;
  for (const ref of def.checklistRefs ?? []) {
    for (const item of resolveChecklist(ref)) {
      seq += 1;
      rows.push({
        checklistItemId: item.inspectionId,
        checklistId,
        templateId: def.templateId,
        sequenceNo: seq,
        inspectionItem: item.label,
        acceptanceCriteria: item.classRequired
          ? "Class attendance / criteria per maker manual"
          : "Per maker manual and company SMS",
        responseType: item.holdPoint ? "pass_fail_na" : "yes_no",
        photoRequiredOnFail: Boolean(item.holdPoint || item.classRequired),
        mandatoryFlag: Boolean(item.holdPoint || item.classRequired || item.qaQcRequired),
      });
    }
  }
  return rows;
}

export function buildScopeStepRows(def: MtilDynamicTemplateDef) {
  const scopeOfWorkId = scopeOfWorkIdForTemplate(def.templateId);
  const rows: Array<{
    scopeStepId: string;
    scopeOfWorkId: string;
    templateId: string;
    sequenceNo: number;
    workStep: string;
    responsibleParty: JobScopeResponsibleParty;
    permitRequired: string | null;
    qaHoldPoint: boolean;
    classHoldPoint: boolean;
  }> = [];

  let seq = 0;
  const push = (
    workStep: string,
    party: JobScopeResponsibleParty,
    opts: { permit?: string | null; qa?: boolean; classHp?: boolean } = {},
  ) => {
    seq += 1;
    rows.push({
      scopeStepId: `${scopeOfWorkId}-${String(seq).padStart(3, "0")}`,
      scopeOfWorkId,
      templateId: def.templateId,
      sequenceNo: seq,
      workStep,
      responsibleParty: party,
      permitRequired: opts.permit ?? null,
      qaHoldPoint: opts.qa ?? false,
      classHoldPoint: opts.classHp ?? false,
    });
  };

  push(
    def.permitRequired
      ? "Obtain permit to work and isolate system (LOTO)"
      : "Prepare work area and verify safety precautions",
    "owner",
    { permit: def.permitRequired ? "work_permit" : null },
  );

  for (const ref of def.checklistRefs ?? []) {
    for (const item of resolveChecklist(ref)) {
      push(item.label, item.classRequired ? "class" : "yard", {
        qa: item.qaQcRequired,
        classHp: item.holdPoint && item.classRequired,
      });
    }
  }

  if (def.measurementRefs?.length) {
    push("Record all mandatory measurements per maker limits", "yard", { qa: true });
  }

  push("Reassemble, test and restore to service", "yard", { qa: def.qaQcRequired });
  push("Submit completion report and obtain approval sign-off", "owner", {
    qa: def.qaQcRequired,
    classHp: def.classHoldPoint,
  });

  return rows;
}

export function buildSpareMappingRows(job: MtilJobDefinition) {
  const spares = resolveSparesForJob({
    dynamicTemplateKey: job.dynamicTemplateKey,
    componentName: job.componentName,
    action: job.action,
  });
  if (spares.length === 0) return [];

  return spares.map((spare, i) => ({
    spareMapId: `SPR-${job.jobId.replace(/^JOB-/, "")}-${String(i + 1).padStart(3, "0")}`,
    jobId: job.jobId,
    templateId: job.templateId,
    itemType: (spare.code.startsWith("SP-FILT") || spare.code.includes("OIL")
      ? "consumable"
      : "spare") as JobSpareItemType,
    itemName: spare.description,
    quantityBasis: "per_job" as JobQuantityBasis,
    recommendedQty: spare.typicalQty ?? 1,
    ownerSupplyFlag: true,
    yardSupplyFlag: true,
    remarks: spare.unit ? `Unit: ${spare.unit}` : null,
  }));
}

export function buildAttachmentRequirementRows(def: MtilDynamicTemplateDef) {
  const rows: Array<{
    attachmentRequirementId: string;
    templateId: string;
    attachmentType: JobAttachmentType;
    attachmentName: string;
    stage: JobAttachmentStage;
    mandatoryFlag: boolean;
    allowedFileTypes: string;
  }> = [];

  for (const photo of def.photoSlots ?? ["before", "after"]) {
    rows.push({
      attachmentRequirementId: `ATT-PHOTO-${def.templateId}-${photo.toUpperCase()}`,
      templateId: def.templateId,
      attachmentType: "photo",
      attachmentName: PHOTO_SLOT_LABELS[photo] ?? photo,
      stage: photo === "before" ? "before" : photo === "during" ? "during" : photo === "after" ? "after" : "final",
      mandatoryFlag: photo === "before" || photo === "after",
      allowedFileTypes: "jpg,jpeg,png,webp",
    });
  }

  for (const att of def.requiredAttachments ?? []) {
    rows.push({
      attachmentRequirementId: `ATT-DOC-${def.templateId}-${att.toUpperCase()}`,
      templateId: def.templateId,
      attachmentType: att.includes("permit") ? "certificate" : att.includes("risk") ? "report" : "manual",
      attachmentName: att.replace(/_/g, " "),
      stage: "before",
      mandatoryFlag: att === "work_permit" || att === "risk_assessment",
      allowedFileTypes: "pdf,doc,docx,jpg,png",
    });
  }

  for (const report of def.requiredReports ?? []) {
    rows.push({
      attachmentRequirementId: `ATT-RPT-${def.templateId}-${report.toUpperCase()}`,
      templateId: def.templateId,
      attachmentType: "report",
      attachmentName: report.replace(/_/g, " "),
      stage: "final",
      mandatoryFlag: true,
      allowedFileTypes: "pdf,doc,docx",
    });
  }

  return rows;
}

const PROJECT_TYPE_MAP: Record<string, DryDockProjectType> = {
  "Special Survey": "special_survey",
  "Intermediate Survey": "intermediate_survey",
  "Damage Repair": "damage_repair",
  "Occasional Repair": "occasional_repair",
  "Underwater Survey": "underwater_survey",
  "New Installation": "new_installation",
  "Emergency Docking": "emergency_docking",
  "Lay-up / Reactivation": "layup_reactivation",
  "Conversion / Modification": "conversion_modification",
  "Warranty Repair": "warranty_repair",
};

export function mapJobToMasterLibraryRow(job: MtilJobDefinition, jobLibraryNodeId: string | null) {
  const applicableProjectTypes = (job.projectTypeApplicability ?? MTIL_PROJECT_TYPES)
    .map((p) => PROJECT_TYPE_MAP[p])
    .filter(Boolean) as DryDockProjectType[];

  const priorityToRisk = {
    low: "low",
    medium: "medium",
    high: "high",
    critical: "critical",
  } as const;

  return {
    jobId: job.jobId,
    libraryVersion: "0.2.0",
    department: "engine" as JobCatalogDepartment,
    systemGroup: job.systemName,
    machinery: job.machineryName,
    component: job.componentName,
    subComponent: job.subComponent ?? null,
    standardJobName: job.title,
    jobDescription: job.description ?? job.title,
    applicableVesselTypes: job.vesselTypeApplicability ?? ["All Types"],
    applicableProjectTypes,
    surveyType: job.action === "survey" ? "Class survey" : null,
    workshop: "machinery" as JobCatalogWorkshop,
    responsibleUserRole: job.responsibleUser ?? "Chief Engineer",
    reviewRole: "Chief Engineer",
    approvalRole: "Superintendent",
    templateId: job.templateId,
    measurementSetId: job.measurementRefs?.length
      ? measurementSetIdForTemplate(job.templateId)
      : null,
    inspectionChecklistId: job.checklistRefs?.length
      ? checklistIdForTemplate(job.templateId)
      : null,
    scopeOfWorkId: scopeOfWorkIdForTemplate(job.templateId),
    rfqCategory: job.rfqMapping?.rfqCategory ?? "Machinery",
    budgetCategory: job.budgetMapping?.budgetCategory ?? "Machinery",
    dryDockCostCode: job.budgetMapping?.costCode ?? job.jobId,
    mandatoryFlag: job.classHoldPoint ?? false,
    classHoldPoint: job.classHoldPoint ?? false,
    makerAttendanceRequired: false,
    permitRequired: job.permitRequired ? ["hot_work", "enclosed_space"] : [],
    photoRequired: (job.requiredPhotos?.length ?? 0) > 0,
    attachmentRequired: (job.requiredAttachments?.length ?? 0) > 0,
    standardManHours: job.estimatedManhours,
    riskLevel: priorityToRisk[job.defaultPriority] ?? "medium",
    activeFlag: true,
    remarks: null,
    jobLibraryNodeId,
  };
}
