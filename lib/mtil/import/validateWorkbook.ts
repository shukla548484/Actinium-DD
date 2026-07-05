import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { CONTROLLED_PROJECT_LABELS, CONTROLLED_VESSEL_LABELS } from "@/lib/mtil/import/excelValues";

export type ImportValidationIssue = {
  rule: number;
  sheet: string;
  row?: number;
  message: string;
};

export type ImportValidationResult = {
  valid: boolean;
  errors: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
  summary: {
    masterJobs: number;
    templates: number;
    measurements: number;
    checklistItems: number;
    scopeSteps: number;
    attachments: number;
    spares: number;
    rfqMappings: number;
    workflows: number;
  };
};

function error(rule: number, sheet: string, message: string, row?: number): ImportValidationIssue {
  return { rule, sheet, row, message };
}

/** R0.1 import validation rules (01_Import_Validation_Rules.txt). */
export function validateMtilWorkbook(data: ParsedMtilWorkbook): ImportValidationResult {
  const errors: ImportValidationIssue[] = [];
  const warnings: ImportValidationIssue[] = [];

  const templateIds = new Set(data.templates.map((t) => t.templateId));
  const measurementSetIds = new Set(
    data.measurements.map((m) => m.measurementSetId).filter(Boolean),
  );
  const checklistIds = new Set(data.checklistItems.map((c) => c.checklistId).filter(Boolean));
  const workflowIds = new Set(data.workflows.map((w) => w.workflowId));
  const jobIds = new Set(data.masterJobs.map((j) => j.jobId));

  const summary = {
    masterJobs: data.masterJobs.length,
    templates: data.templates.length,
    measurements: data.measurements.length,
    checklistItems: data.checklistItems.length,
    scopeSteps: data.scopeSteps.length,
    attachments: data.attachments.length,
    spares: data.spares.length,
    rfqMappings: data.rfqMappings.length,
    workflows: data.workflows.length,
  };

  if (data.masterJobs.length === 0) {
    if (data.initializedOnly) {
      warnings.push(
        error(0, "01_Master_Job_Library", "Phase initialized — job library pending curated content."),
      );
      return { valid: true, errors, warnings, summary };
    }
    errors.push(error(0, "01_Master_Job_Library", "Workbook has no master job rows."));
    return { valid: false, errors, warnings, summary };
  }

  // Rule 1 — Job ID unique
  const seenJobIds = new Set<string>();
  for (const job of data.masterJobs) {
    if (seenJobIds.has(job.jobId)) {
      errors.push(error(1, "01_Master_Job_Library", `Duplicate Job ID: ${job.jobId}`, job.rowNumber));
    }
    seenJobIds.add(job.jobId);
  }

  // Rule 11 — No duplicate standard job under same machinery/component/template
  const jobComposite = new Set<string>();
  for (const job of data.masterJobs) {
    const key = `${job.machinery}|${job.component}|${job.templateId}|${job.standardJobName}`;
    if (jobComposite.has(key)) {
      errors.push(
        error(
          11,
          "01_Master_Job_Library",
          `Duplicate standard job for ${job.machinery} / ${job.component} / ${job.templateId}: ${job.standardJobName}`,
          job.rowNumber,
        ),
      );
    }
    jobComposite.add(key);
  }

  for (const job of data.masterJobs) {
    // Rule 2 — Template ID must exist
    if (!templateIds.has(job.templateId)) {
      errors.push(
        error(2, "01_Master_Job_Library", `Template ID not found in tab 02: ${job.templateId}`, job.rowNumber),
      );
    }

    // Rule 3 — Measurement Set ID must exist if required
    if (job.measurementSetId && !measurementSetIds.has(job.measurementSetId)) {
      errors.push(
        error(
          3,
          "01_Master_Job_Library",
          `Measurement Set ID not found in tab 03: ${job.measurementSetId}`,
          job.rowNumber,
        ),
      );
    }

    // Rule 4 — Inspection Checklist ID must exist if required
    if (job.inspectionChecklistId && !checklistIds.has(job.inspectionChecklistId)) {
      errors.push(
        error(
          4,
          "01_Master_Job_Library",
          `Inspection Checklist ID not found in tab 04: ${job.inspectionChecklistId}`,
          job.rowNumber,
        ),
      );
    }

    // Rule 5 — RFQ category cannot be empty
    if (!job.rfqCategory.trim()) {
      errors.push(error(5, "01_Master_Job_Library", "RFQ category is required.", job.rowNumber));
    }

    // Rule 6 — Budget category cannot be empty
    if (!job.budgetCategory.trim()) {
      errors.push(error(6, "01_Master_Job_Library", "Budget category is required.", job.rowNumber));
    }

    // Rule 10 — Vessel type from controlled list
    for (const vesselType of job.applicableVesselTypes) {
      if (!CONTROLLED_VESSEL_LABELS.has(vesselType)) {
        errors.push(
          error(10, "01_Master_Job_Library", `Vessel type not in controlled list: ${vesselType}`, job.rowNumber),
        );
      }
    }

    // Rule 9 — Project type from controlled list
    for (const projectType of job.applicableProjectTypes) {
      const label = projectType
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const known = [...CONTROLLED_PROJECT_LABELS].some(
        (p) => p.toLowerCase().replace(/[^a-z0-9]+/g, "_") === projectType,
      );
      if (!known) {
        warnings.push(
          error(9, "01_Master_Job_Library", `Project type mapped from workbook: ${projectType} (${label})`, job.rowNumber),
        );
      }
    }

    // Rule 12 — No unmapped workshop (parsed rows already mapped; empty workshop would fail parse)
    if (!job.workshop) {
      errors.push(error(12, "01_Master_Job_Library", "Workshop is required.", job.rowNumber));
    }
  }

  for (const template of data.templates) {
    if (!workflowIds.has(template.approvalWorkflowId)) {
      errors.push(
        error(2, "02_Dynamic_Templates", `Approval workflow not found in tab 09: ${template.approvalWorkflowId}`, template.rowNumber),
      );
    }
  }

  for (const rfq of data.rfqMappings) {
    if (!jobIds.has(rfq.jobId)) {
      errors.push(error(1, "08_RFQ_Budget_Mapping", `Job ID not found in tab 01: ${rfq.jobId}`, rfq.rowNumber));
    }
    if (!rfq.rfqSection.trim()) {
      errors.push(error(5, "08_RFQ_Budget_Mapping", "RFQ section is required.", rfq.rowNumber));
    }
    if (!rfq.budgetCategory.trim()) {
      errors.push(error(6, "08_RFQ_Budget_Mapping", "Budget category is required.", rfq.rowNumber));
    }
  }

  for (const spare of data.spares) {
    if (!jobIds.has(spare.jobId)) {
      errors.push(error(1, "07_Spares_Materials", `Job ID not found in tab 01: ${spare.jobId}`, spare.rowNumber));
    }
    if (!templateIds.has(spare.templateId)) {
      errors.push(error(2, "07_Spares_Materials", `Template ID not found in tab 02: ${spare.templateId}`, spare.rowNumber));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}
