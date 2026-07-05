import { prisma } from "@/lib/prisma";
import { upsertJobCatalogFromParsed } from "@/lib/mtil/db/upsertJobCatalogWorkbook";
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

async function upsertFromWorkbook(data: ParsedMtilWorkbook) {
  return upsertJobCatalogFromParsed(data);
}

async function pruneGeneratedPhase1(prefix = "ENG-ME") {
  const jobFilter = {
    OR: [{ jobId: { startsWith: `JOBS-${prefix}-` } }, { jobId: { startsWith: `JOB-${prefix}-` } }],
  };
  const templateFilter = {
    OR: [
      { templateId: { startsWith: `TMPL-${prefix}-` } },
      { templateId: { startsWith: `TMP-${prefix}-` } },
    ],
  };

  const [spareLegacy, spareCanonical, rfqLegacy, rfqCanonical, masterJobs, templates] =
    await prisma.$transaction([
      prisma.jobSpareMapping.deleteMany({ where: { jobId: { startsWith: `JOB-${prefix}-` } } }),
      prisma.jobSpareMapping.deleteMany({ where: { jobId: { startsWith: `JOBS-${prefix}-` } } }),
      prisma.jobRfqBudgetMapping.deleteMany({ where: { jobId: { startsWith: `JOB-${prefix}-` } } }),
      prisma.jobRfqBudgetMapping.deleteMany({ where: { jobId: { startsWith: `JOBS-${prefix}-` } } }),
      prisma.masterJobLibrary.deleteMany({ where: jobFilter }),
      prisma.jobDynamicTemplate.deleteMany({ where: templateFilter }),
    ]);

  return {
    spareMappings: spareLegacy.count + spareCanonical.count,
    rfqMappings: rfqLegacy.count + rfqCanonical.count,
    masterJobs: masterJobs.count,
    templates: templates.count,
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
