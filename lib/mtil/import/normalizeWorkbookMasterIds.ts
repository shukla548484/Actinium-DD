import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import {
  EXTENDED_ENTITY_CODES,
  MASTER_ENTITY_CODES,
  normalizeMasterId,
} from "@/lib/mtil/masterCodeStandard";

function remapId(id: string | null | undefined, entityOverride?: keyof typeof MASTER_ENTITY_CODES): string | null {
  if (!id) return id ?? null;
  return normalizeMasterId(id, entityOverride ? MASTER_ENTITY_CODES[entityOverride] : undefined);
}

/**
 * Normalize all commercial IDs in a parsed workbook to Master Code Standard v1.0.
 * Legacy workbook exports (JOB/TMP/MEA/INS/SOW/SPR/WF) are upgraded on import.
 */
export function normalizeWorkbookMasterIds(data: ParsedMtilWorkbook): ParsedMtilWorkbook {
  const idRemap = new Map<string, string>();
  const remember = (from: string | null | undefined, to: string | null | undefined) => {
    if (from && to && from !== to) idRemap.set(from, to);
  };

  const masterJobs = data.masterJobs.map((job) => {
    const jobId = normalizeMasterId(job.jobId, MASTER_ENTITY_CODES.JOBS);
    const templateId = normalizeMasterId(job.templateId, MASTER_ENTITY_CODES.TMPL);
    const measurementSetId = remapId(job.measurementSetId, "MEAS");
    const inspectionChecklistId = remapId(job.inspectionChecklistId, "INSP");
    const scopeOfWorkId = remapId(job.scopeOfWorkId, "SCOP");

    remember(job.jobId, jobId);
    remember(job.templateId, templateId);
    remember(job.measurementSetId, measurementSetId);
    remember(job.inspectionChecklistId, inspectionChecklistId);
    remember(job.scopeOfWorkId, scopeOfWorkId);

    return {
      ...job,
      jobId,
      templateId,
      measurementSetId,
      inspectionChecklistId,
      scopeOfWorkId,
      subComponent: job.subComponent
        ? normalizeMasterId(job.subComponent, MASTER_ENTITY_CODES.EQPM)
        : job.subComponent,
    };
  });

  const templates = data.templates.map((row) => {
    const templateId = normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    const measurementSetId = remapId(row.measurementSetId, "MEAS");
    const checklistId = remapId(row.checklistId, "INSP");
    const approvalWorkflowId = normalizeMasterId(row.approvalWorkflowId, MASTER_ENTITY_CODES.WORK);

    remember(row.templateId, templateId);
    remember(row.measurementSetId, measurementSetId);
    remember(row.checklistId, checklistId);
    remember(row.approvalWorkflowId, approvalWorkflowId);

    return {
      ...row,
      templateId,
      measurementSetId,
      checklistId,
      approvalWorkflowId,
    };
  });

  const measurements = data.measurements.map((row) => {
    const measurementId = normalizeMasterId(row.measurementId, MASTER_ENTITY_CODES.MEAS);
    const measurementSetId = normalizeMasterId(row.measurementSetId, MASTER_ENTITY_CODES.MEAS);
    const templateId = normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.measurementId, measurementId);
    remember(row.measurementSetId, measurementSetId);
    remember(row.templateId, templateId);
    return { ...row, measurementId, measurementSetId, templateId };
  });

  const checklistItems = data.checklistItems.map((row) => {
    const checklistItemId = normalizeMasterId(row.checklistItemId, MASTER_ENTITY_CODES.INSP);
    const checklistId = normalizeMasterId(row.checklistId, MASTER_ENTITY_CODES.INSP);
    const templateId = normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.checklistItemId, checklistItemId);
    remember(row.checklistId, checklistId);
    remember(row.templateId, templateId);
    return { ...row, checklistItemId, checklistId, templateId };
  });

  const scopeSteps = data.scopeSteps.map((row) => {
    const scopeStepId = normalizeMasterId(row.scopeStepId, MASTER_ENTITY_CODES.SCOP);
    const scopeOfWorkId = normalizeMasterId(row.scopeOfWorkId, MASTER_ENTITY_CODES.SCOP);
    const templateId = normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.scopeStepId, scopeStepId);
    remember(row.scopeOfWorkId, scopeOfWorkId);
    remember(row.templateId, templateId);
    return { ...row, scopeStepId, scopeOfWorkId, templateId };
  });

  const attachments = data.attachments.map((row) => {
    const attachmentRequirementId = normalizeMasterId(row.attachmentRequirementId, EXTENDED_ENTITY_CODES.ATCH);
    const templateId = normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.attachmentRequirementId, attachmentRequirementId);
    remember(row.templateId, templateId);
    return { ...row, attachmentRequirementId, templateId };
  });

  const spares = data.spares.map((row) => {
    const spareMapId = normalizeMasterId(row.spareMapId, MASTER_ENTITY_CODES.SPAR);
    const jobId = idRemap.get(row.jobId) ?? normalizeMasterId(row.jobId, MASTER_ENTITY_CODES.JOBS);
    const templateId = idRemap.get(row.templateId) ?? normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.spareMapId, spareMapId);
    return { ...row, spareMapId, jobId, templateId };
  });

  const rfqMappings = data.rfqMappings.map((row) => {
    const mappingId = normalizeMasterId(row.mappingId, MASTER_ENTITY_CODES.RFQM);
    const jobId = idRemap.get(row.jobId) ?? normalizeMasterId(row.jobId, MASTER_ENTITY_CODES.JOBS);
    remember(row.mappingId, mappingId);
    return { ...row, mappingId, jobId };
  });

  const workflows = data.workflows.map((row) => {
    const workflowId = normalizeMasterId(row.workflowId, MASTER_ENTITY_CODES.WORK);
    const templateId = idRemap.get(row.templateId) ?? normalizeMasterId(row.templateId, MASTER_ENTITY_CODES.TMPL);
    remember(row.workflowId, workflowId);
    remember(row.templateId, templateId);
    return { ...row, workflowId, templateId };
  });

  return {
    ...data,
    masterJobs,
    templates,
    measurements,
    checklistItems,
    scopeSteps,
    attachments,
    spares,
    rfqMappings,
    workflows,
  };
}
