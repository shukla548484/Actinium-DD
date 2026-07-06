import { prisma } from "@/lib/prisma";
import { buildCatalogListItems } from "@/lib/mtil/db/catalogLists";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";

async function syncCatalogLists() {
  for (const row of buildCatalogListItems()) {
    await prisma.jobCatalogListItem.upsert({
      where: { listType_value: { listType: row.listType, value: row.value } },
      create: { ...row, isActive: true },
      update: { label: row.label, sortOrder: row.sortOrder, isActive: true },
    });
  }
  return buildCatalogListItems().length;
}

/** Upsert parsed MTIL / V2 sprint workbook rows into job catalog tables. */
export async function upsertJobCatalogFromParsed(data: ParsedMtilWorkbook) {
  const workflowById = new Map<string, (typeof data.workflows)[number]>();
  for (const wf of data.workflows) {
    if (!workflowById.has(wf.workflowId)) workflowById.set(wf.workflowId, wf);
  }

  for (const wf of workflowById.values()) {
    const { rowNumber: _row, templateId: _templateId, ...row } = wf;
    await prisma.jobApprovalWorkflow.upsert({
      where: { workflowId: wf.workflowId },
      create: {
        workflowId: row.workflowId,
        templateId: wf.templateId,
        createdByRole: row.createdByRole,
        reviewByRole: row.reviewByRole,
        approveByRole: row.approveByRole,
        shipyardUpdateRole: row.shipyardUpdateRole,
        classApprovalRequired: row.classApprovalRequired,
        ownerApprovalRequired: row.ownerApprovalRequired,
        statusFlow: row.statusFlow,
      },
      update: {
        createdByRole: row.createdByRole,
        reviewByRole: row.reviewByRole,
        approveByRole: row.approveByRole,
        shipyardUpdateRole: row.shipyardUpdateRole,
        classApprovalRequired: row.classApprovalRequired,
        ownerApprovalRequired: row.ownerApprovalRequired,
        statusFlow: row.statusFlow,
      },
    });
  }

  for (const template of data.templates) {
    const { rowNumber: _row, ...row } = template;
    await prisma.jobDynamicTemplate.upsert({
      where: { templateId: template.templateId },
      create: row,
      update: row,
    });
  }

  for (const m of data.measurements) {
    const { rowNumber: _row, ...row } = m;
    await prisma.jobMeasurement.upsert({
      where: { measurementId: m.measurementId },
      create: row,
      update: row,
    });
  }

  for (const item of data.checklistItems) {
    const { rowNumber: _row, ...row } = item;
    await prisma.jobChecklistItem.upsert({
      where: { checklistItemId: item.checklistItemId },
      create: row,
      update: row,
    });
  }

  for (const step of data.scopeSteps) {
    const { rowNumber: _row, ...row } = step;
    await prisma.jobScopeStep.upsert({
      where: { scopeStepId: step.scopeStepId },
      create: row,
      update: row,
    });
  }

  for (const att of data.attachments) {
    const { rowNumber: _row, ...row } = att;
    await prisma.jobAttachmentRequirement.upsert({
      where: { attachmentRequirementId: att.attachmentRequirementId },
      create: row,
      update: row,
    });
  }

  for (const job of data.masterJobs) {
    const { rowNumber: _row, ...row } = job;
    await prisma.masterJobLibrary.upsert({
      where: { jobId: job.jobId },
      create: { ...row, jobLibraryNodeId: null },
      update: row,
    });
  }

  for (const spare of data.spares) {
    const { rowNumber: _row, ...row } = spare;
    await prisma.jobSpareMapping.upsert({
      where: { spareMapId: spare.spareMapId },
      create: row,
      update: row,
    });
  }

  for (const rfq of data.rfqMappings) {
    const { rowNumber: _row, ...row } = rfq;
    const payload = {
      ...row,
      quoteComparisonSection: row.quoteComparisonSection || row.rfqSection,
    };
    await prisma.jobRfqBudgetMapping.upsert({
      where: { mappingId: rfq.mappingId },
      create: payload,
      update: payload,
    });
  }

  const catalogListItems = await syncCatalogLists();

  return {
    workflows: workflowById.size,
    templates: data.templates.length,
    measurements: data.measurements.length,
    checklistItems: data.checklistItems.length,
    scopeSteps: data.scopeSteps.length,
    attachments: data.attachments.length,
    masterJobs: data.masterJobs.length,
    spareMappings: data.spares.length,
    rfqMappings: data.rfqMappings.length,
    catalogListItems,
  };
}
