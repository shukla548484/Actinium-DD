import { prisma } from "@/lib/prisma";
import { getAllPhase1Templates } from "@/lib/mtil/phases/phase1/templateCatalog";
import { generatePhase1JobDefinitions } from "@/lib/mtil/phases/phase1/generate";
import {
  buildAttachmentRequirementRows,
  buildChecklistRows,
  buildDynamicTemplatePayload,
  buildMeasurementRows,
  buildScopeStepRows,
  buildSpareMappingRows,
  inferTemplateCategory,
  inferUiLayout,
  mapJobToMasterLibraryRow,
} from "@/lib/mtil/db/mapToJobCatalog";
import { buildCatalogListItems } from "@/lib/mtil/db/catalogLists";
import { STANDARD_ME_APPROVAL_WORKFLOW_ID } from "@/lib/jobCatalog/types";

const LIBRARY_VERSION = "0.2.0";

async function ensureStandardWorkflow() {
  await prisma.jobApprovalWorkflow.upsert({
    where: { workflowId: STANDARD_ME_APPROVAL_WORKFLOW_ID },
    create: {
      workflowId: STANDARD_ME_APPROVAL_WORKFLOW_ID,
      templateId: "TMP-ENG-ME-0000",
      createdByRole: "Chief Engineer",
      reviewByRole: "Chief Engineer",
      approveByRole: "Superintendent",
      shipyardUpdateRole: "Shipyard Planner",
      classApprovalRequired: true,
      ownerApprovalRequired: false,
      statusFlow: "draft→submitted→reviewed→approved→in_progress→completed→closed",
    },
    update: {},
  });
}

async function upsertTemplate(def: ReturnType<typeof getAllPhase1Templates>[number]) {
  const payload = buildDynamicTemplatePayload(def);

  await prisma.jobDynamicTemplate.upsert({
    where: { templateId: def.templateId },
    create: {
      templateId: def.templateId,
      templateName: def.label,
      templateCategory: inferTemplateCategory(def.key),
      version: LIBRARY_VERSION,
      formSections: payload.formSections,
      autoFillFields: payload.autoFillFields,
      manualInputFields: payload.manualInputFields,
      requiredPhotos: payload.requiredPhotos,
      requiredAttachments: payload.requiredAttachments,
      measurementSetId: payload.measurementSetId,
      checklistId: payload.checklistId,
      approvalWorkflowId: payload.approvalWorkflowId,
      uiLayoutType: inferUiLayout(def.key),
      activeFlag: true,
    },
    update: {
      templateName: def.label,
      templateCategory: inferTemplateCategory(def.key),
      version: LIBRARY_VERSION,
      formSections: payload.formSections,
      autoFillFields: payload.autoFillFields,
      manualInputFields: payload.manualInputFields,
      requiredPhotos: payload.requiredPhotos,
      requiredAttachments: payload.requiredAttachments,
      measurementSetId: payload.measurementSetId,
      checklistId: payload.checklistId,
      approvalWorkflowId: payload.approvalWorkflowId,
      uiLayoutType: inferUiLayout(def.key),
      activeFlag: true,
    },
  });

  for (const m of buildMeasurementRows(def)) {
    await prisma.jobMeasurement.upsert({
      where: { measurementId: m.measurementId },
      create: m,
      update: m,
    });
  }

  for (const item of buildChecklistRows(def)) {
    await prisma.jobChecklistItem.upsert({
      where: { checklistItemId: item.checklistItemId },
      create: item,
      update: item,
    });
  }

  for (const step of buildScopeStepRows(def)) {
    await prisma.jobScopeStep.upsert({
      where: { scopeStepId: step.scopeStepId },
      create: step,
      update: step,
    });
  }

  for (const att of buildAttachmentRequirementRows(def)) {
    await prisma.jobAttachmentRequirement.upsert({
      where: { attachmentRequirementId: att.attachmentRequirementId },
      create: att,
      update: att,
    });
  }
}

async function syncCatalogLists() {
  for (const row of buildCatalogListItems()) {
    await prisma.jobCatalogListItem.upsert({
      where: { listType_value: { listType: row.listType, value: row.value } },
      create: { ...row, isActive: true },
      update: { label: row.label, sortOrder: row.sortOrder, isActive: true },
    });
  }
}

async function syncMasterJobs() {
  const jobs = generatePhase1JobDefinitions();
  const nodes = await prisma.jobLibraryNode.findMany({
    where: { nodeType: "standard_job", mtilPhase: 1, deletedAt: null },
    select: { id: true, mtilJobCode: true, referenceCode: true },
  });
  const nodeByRef = new Map(nodes.map((n) => [n.referenceCode ?? n.mtilJobCode ?? "", n.id]));

  let spareCount = 0;

  for (const job of jobs) {
    const nodeId = nodeByRef.get(job.jobId) ?? nodeByRef.get(job.mtilJobCode) ?? null;
    const row = mapJobToMasterLibraryRow(job, nodeId);
    await prisma.masterJobLibrary.upsert({
      where: { jobId: job.jobId },
      create: row,
      update: { ...row, jobLibraryNodeId: nodeId },
    });

    if (job.rfqMapping) {
      await prisma.jobRfqBudgetMapping.upsert({
        where: { mappingId: `MAP-${job.jobId}` },
        create: {
          mappingId: `MAP-${job.jobId}`,
          jobId: job.jobId,
          rfqSection: job.rfqMapping.rfqCategory,
          quoteComparisonSection: job.rfqMapping.rfqCategory,
          budgetCategory: row.budgetCategory,
          costCode: row.dryDockCostCode,
          workshop: row.workshop,
          pricingBasis: "lump_sum",
          discountApplicable: false,
          netItemFlag: false,
        },
        update: {
          rfqSection: job.rfqMapping.rfqCategory,
          budgetCategory: row.budgetCategory,
          costCode: row.dryDockCostCode,
        },
      });
    }

    for (const spare of buildSpareMappingRows(job)) {
      spareCount += 1;
      await prisma.jobSpareMapping.upsert({
        where: { spareMapId: spare.spareMapId },
        create: spare,
        update: spare,
      });
    }
  }

  return spareCount;
}

export async function seedJobCatalogPhase1(): Promise<{
  templates: number;
  masterJobs: number;
  scopeSteps: number;
  spareMappings: number;
  catalogListItems: number;
  alreadySeeded: boolean;
}> {
  const existing = await prisma.jobDynamicTemplate.count({
    where: { templateId: { startsWith: "TMP-ENG-ME-" }, version: LIBRARY_VERSION },
  });

  await ensureStandardWorkflow();
  await syncCatalogLists();

  const templates = getAllPhase1Templates();
  for (const def of templates) {
    await upsertTemplate(def);
  }

  const scopeSteps = await prisma.jobScopeStep.count({
    where: { templateId: { startsWith: "TMP-ENG-ME-" } },
  });
  const spareMappings = await syncMasterJobs();
  const catalogListItems = await prisma.jobCatalogListItem.count();

  return {
    templates: templates.length,
    masterJobs: generatePhase1JobDefinitions().length,
    scopeSteps,
    spareMappings,
    catalogListItems,
    alreadySeeded: existing >= 25,
  };
}

export async function isJobCatalogPhase1Seeded(): Promise<boolean> {
  const count = await prisma.jobDynamicTemplate.count({
    where: { templateId: "TMP-ENG-ME-0001", activeFlag: true },
  });
  return count > 0;
}

export async function getJobCatalogPhase1Stats() {
  const [templates, masterJobs, measurements, checklistItems, scopeSteps, spareMappings, listItems] =
    await Promise.all([
      prisma.jobDynamicTemplate.count({ where: { templateId: { startsWith: "TMP-ENG-ME-" } } }),
      prisma.masterJobLibrary.count({ where: { libraryVersion: LIBRARY_VERSION } }),
      prisma.jobMeasurement.count({ where: { templateId: { startsWith: "TMP-ENG-ME-" } } }),
      prisma.jobChecklistItem.count({ where: { templateId: { startsWith: "TMP-ENG-ME-" } } }),
      prisma.jobScopeStep.count({ where: { templateId: { startsWith: "TMP-ENG-ME-" } } }),
      prisma.jobSpareMapping.count(),
      prisma.jobCatalogListItem.count(),
    ]);

  return { templates, masterJobs, measurements, checklistItems, scopeSteps, spareMappings, listItems };
}
