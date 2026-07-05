import { prisma } from "@/lib/prisma";
import { buildCatalogListItems } from "@/lib/mtil/db/catalogLists";
import { getJobCatalogStats } from "@/lib/db/jobCatalogStats";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { parseMtilWorkbookBuffer } from "@/lib/mtil/import/parseWorkbook";
import { validateMtilWorkbook } from "@/lib/mtil/import/validateWorkbook";

export type JobCatalogImportMode = "merge" | "replace";

export type JobCatalogImportResult = {
  ok: boolean;
  libraryVersion: string | null;
  mode: JobCatalogImportMode;
  validation: ReturnType<typeof validateMtilWorkbook>;
  pruned?: {
    masterJobs: number;
    templates: number;
    spareMappings: number;
    rfqMappings: number;
  };
  imported: {
    workflows: number;
    templates: number;
    measurements: number;
    checklistItems: number;
    scopeSteps: number;
    attachments: number;
    masterJobs: number;
    spareMappings: number;
    rfqMappings: number;
    catalogListItems: number;
  };
  diff?: {
    previousMasterJobs: number;
    previousTemplates: number;
    curatedMasterJobs: number;
    curatedTemplates: number;
  };
  stats?: Awaited<ReturnType<typeof getJobCatalogStats>>;
  error?: string;
};

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

async function pruneGeneratedPhase1(prefix = "ENG-ME") {
  const jobFilter = { startsWith: `JOB-${prefix}-` };
  const templateFilter = { startsWith: `TMP-${prefix}-` };

  const [spareMappings, rfqMappings, masterJobs, templates] = await prisma.$transaction([
    prisma.jobSpareMapping.deleteMany({ where: { jobId: jobFilter } }),
    prisma.jobRfqBudgetMapping.deleteMany({ where: { jobId: jobFilter } }),
    prisma.masterJobLibrary.deleteMany({ where: { jobId: jobFilter } }),
    prisma.jobDynamicTemplate.deleteMany({ where: { templateId: templateFilter } }),
  ]);

  return {
    spareMappings: spareMappings.count,
    rfqMappings: rfqMappings.count,
    masterJobs: masterJobs.count,
    templates: templates.count,
  };
}

async function upsertFromWorkbook(data: ParsedMtilWorkbook) {
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
    await prisma.jobRfqBudgetMapping.upsert({
      where: { mappingId: rfq.mappingId },
      create: row,
      update: row,
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

export async function importJobCatalogFromWorkbook(
  buffer: ArrayBuffer | Uint8Array,
  options: { mode?: JobCatalogImportMode; phasePrefix?: string } = {},
): Promise<JobCatalogImportResult> {
  const mode = options.mode ?? "replace";
  const phasePrefix = options.phasePrefix ?? "ENG-ME";

  try {
    const data = parseMtilWorkbookBuffer(buffer);
    const validation = validateMtilWorkbook(data);

    if (!validation.valid) {
      return {
        ok: false,
        libraryVersion: data.libraryVersion,
        mode,
        validation,
        imported: {
          workflows: 0,
          templates: 0,
          measurements: 0,
          checklistItems: 0,
          scopeSteps: 0,
          attachments: 0,
          masterJobs: 0,
          spareMappings: 0,
          rfqMappings: 0,
          catalogListItems: 0,
        },
        error: `Validation failed with ${validation.errors.length} error(s).`,
      };
    }

    const [previousMasterJobs, previousTemplates] = await Promise.all([
      prisma.masterJobLibrary.count({ where: { jobId: { startsWith: `JOB-${phasePrefix}-` } } }),
      prisma.jobDynamicTemplate.count({ where: { templateId: { startsWith: `TMP-${phasePrefix}-` } } }),
    ]);

    let pruned: JobCatalogImportResult["pruned"];
    if (mode === "replace") {
      pruned = await pruneGeneratedPhase1(phasePrefix);
    }

    const imported = await upsertFromWorkbook(data);
    const stats = await getJobCatalogStats();

    return {
      ok: true,
      libraryVersion: data.libraryVersion,
      mode,
      validation,
      pruned,
      imported,
      diff: {
        previousMasterJobs,
        previousTemplates,
        curatedMasterJobs: data.masterJobs.length,
        curatedTemplates: data.templates.length,
      },
      stats,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workbook import failed";
    return {
      ok: false,
      libraryVersion: null,
      mode,
      validation: {
        valid: false,
        errors: [{ rule: 0, sheet: "workbook", message }],
        warnings: [],
        summary: {
          masterJobs: 0,
          templates: 0,
          measurements: 0,
          checklistItems: 0,
          scopeSteps: 0,
          attachments: 0,
          spares: 0,
          rfqMappings: 0,
          workflows: 0,
        },
      },
      imported: {
        workflows: 0,
        templates: 0,
        measurements: 0,
        checklistItems: 0,
        scopeSteps: 0,
        attachments: 0,
        masterJobs: 0,
        spareMappings: 0,
        rfqMappings: 0,
        catalogListItems: 0,
      },
      error: message,
    };
  }
}

export async function importJobCatalogFromPath(
  filePath: string,
  options: { mode?: JobCatalogImportMode; phasePrefix?: string } = {},
): Promise<JobCatalogImportResult> {
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(filePath);
  return importJobCatalogFromWorkbook(bytes, options);
}
