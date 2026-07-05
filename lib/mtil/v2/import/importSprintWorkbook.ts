import path from "node:path";
import fs from "node:fs";
import { emdrWorkbookPath, MTIL_V2_WORKBOOKS_DIR } from "@/lib/emdr/paths";
import { prisma } from "@/lib/prisma";
import { upsertJobCatalogFromParsed } from "@/lib/mtil/db/upsertJobCatalogWorkbook";
import { getJobCatalogStats } from "@/lib/db/jobCatalogStats";
import type { ParsedEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import { validateEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { validateMtilWorkbook } from "@/lib/mtil/import/validateWorkbook";
import type { JobCatalogImportMode, JobCatalogImportResult } from "@/lib/mtil/import/importJobCatalogWorkbook";
import {
  parseV2SprintWorkbookBuffer,
  parseV2SprintWorkbookFile,
} from "@/lib/mtil/v2/import/parseSprintWorkbook";

export async function importV2SprintFromParsed(
  data: ParsedMtilWorkbook | ParsedEmdrSprintWorkbook,
  options: { mode?: JobCatalogImportMode; jobIdPrefix?: string } = {},
): Promise<JobCatalogImportResult & { emdr?: ReturnType<typeof validateEmdrSprintWorkbook> }> {
  const mode = options.mode ?? "merge";
  const jobIdPrefix = options.jobIdPrefix ?? "ME-CYU";

  try {
    const validation = validateMtilWorkbook(data);
    const emdrValidation =
      "emdrMasterData" in data ? validateEmdrSprintWorkbook(data) : null;

    if (!validation.valid) {
      return {
        ok: false,
        libraryVersion: data.libraryVersion,
        mode,
        validation,
        emdr: emdrValidation ?? undefined,
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

    if (emdrValidation && !emdrValidation.valid) {
      return {
        ok: false,
        libraryVersion: data.libraryVersion,
        mode,
        validation,
        emdr: emdrValidation,
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
        error: `EMDR validation failed with ${emdrValidation.errors.length} error(s).`,
      };
    }

    const jobPrefixFilter = {
      OR: [
        { jobId: { startsWith: `JOBS-${jobIdPrefix}-` } },
        { jobId: { startsWith: `JOB-${jobIdPrefix}-` } },
      ],
    };
    const templatePrefix = jobIdPrefix.split("-");
    const templateFilter = {
      OR: [
        { templateId: { startsWith: `TMPL-${templatePrefix[0]}-${templatePrefix[1] ?? ""}-` } },
        { templateId: { startsWith: `TMP-${templatePrefix[0]}-${templatePrefix[1] ?? ""}-` } },
      ],
    };

    const [previousMasterJobs, previousTemplates] = await Promise.all([
      prisma.masterJobLibrary.count({ where: jobPrefixFilter }),
      prisma.jobDynamicTemplate.count({ where: templateFilter }),
    ]);

    const imported = await upsertJobCatalogFromParsed(data);
    const stats = await getJobCatalogStats();

    return {
      ok: true,
      libraryVersion: data.libraryVersion,
      mode,
      validation,
      emdr: emdrValidation ?? undefined,
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
    const message = err instanceof Error ? err.message : "V2 sprint import failed";
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

export async function importV2SprintFromPath(
  filePath: string,
  options: { mode?: JobCatalogImportMode; jobIdPrefix?: string } = {},
): Promise<JobCatalogImportResult> {
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(filePath);
  const data = parseV2SprintWorkbookBuffer(bytes);
  return importV2SprintFromParsed(data, options);
}

export function resolveV2SprintWorkbookPath(filename: string): string {
  const emdrPath = emdrWorkbookPath(filename);
  if (fs.existsSync(emdrPath)) return emdrPath;
  return path.join(MTIL_V2_WORKBOOKS_DIR, filename);
}

export async function importV2SprintByFilename(
  filename: string,
  options: { mode?: JobCatalogImportMode; jobIdPrefix?: string } = {},
): Promise<JobCatalogImportResult> {
  const filePath = resolveV2SprintWorkbookPath(filename);
  return importV2SprintFromPath(filePath, options);
}

export function getV2SprintStatsFromFile(filePath: string) {
  const data = parseV2SprintWorkbookFile(filePath);
  return {
    libraryVersion: data.libraryVersion,
    jobCount: data.masterJobs.length,
    catalogTemplateCount: data.templates.length,
    measurementCount: data.measurements.length,
    checklistItemCount: data.checklistItems.length,
    scopeStepCount: data.scopeSteps.length,
    spareMappingCount: data.spares.length,
    rfqMappingCount: data.rfqMappings.length,
  };
}
