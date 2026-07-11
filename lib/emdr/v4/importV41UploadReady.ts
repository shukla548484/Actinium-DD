import fs from "node:fs";
import type { JobPricingBasis } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EMDR_V41_EXPORT_DOWNLOADS_PATH,
  EMDR_V41_EXPORT_REPO_PATH,
} from "@/lib/emdr/paths";
import {
  parseV41UploadReadyBuffer,
  parseV41UploadReadyFile,
  type V41BudgetMappingRow,
  type V41DryDockRfqRow,
  type V41ParsedUploadWorkbook,
  type V41PmsUploadRow,
} from "@/lib/emdr/v4/parseV41UploadReady";
import {
  validateV41UploadReady,
  type V41ValidationResult,
} from "@/lib/emdr/v4/validateV41UploadReady";

export type V41ImportMode = "dry-run" | "apply";

export type V41ImportOptions = {
  mode?: V41ImportMode;
  /** Max rows per sheet to write (apply mode only). */
  limit?: number;
  /** Roll back transaction after apply (safe integration test). */
  rollback?: boolean;
  /** Skip rows with Validation_Status = Blocked in PMS sheet. */
  skipBlocked?: boolean;
};

export type V41ImportResult = {
  ok: boolean;
  mode: V41ImportMode;
  filePath: string;
  exportVersion: string | null;
  validation: V41ValidationResult;
  parsed: {
    sheetRowCounts: Record<string, number>;
  };
  dryRun?: {
    wouldImport: {
      pmsMetadata: number;
      dryDockRfqMetadata: number;
      budgetMappings: number;
      masterJobUpdates: number;
    };
    skipped: {
      blockedPms: number;
      inactivePms: number;
      unknownJobIds: number;
    };
    dbCoverage: {
      pmsJobsInDb: number;
      rfqJobsInDb: number;
      budgetJobsInDb: number;
    };
  };
  applied?: {
    pmsMetadata: number;
    dryDockRfqMetadata: number;
    budgetMappings: number;
    masterJobUpdates: number;
    rolledBack: boolean;
  };
  error?: string;
};

function resolveMappingId(jobId: string): string {
  return `RFQM-${jobId.replace(/^JOBS-/, "")}`;
}

function workshopLabel(value: string): string {
  const map: Record<string, string> = {
    machinery: "Machinery Workshop",
    hull: "Hull Workshop",
    electrical: "Electrical Workshop",
    pipe: "Pipe Workshop",
    painting: "Painting Workshop",
    safety: "Safety Workshop",
    deck: "Deck Workshop",
    cargo: "Cargo Workshop",
    accommodation: "Accommodation Workshop",
    general: "General Workshop",
  };
  return map[value] ?? "Machinery Workshop";
}

function inferPricingBasis(rfq: V41DryDockRfqRow): JobPricingBasis {
  const uom = rfq.uom.toLowerCase();
  if (uom.includes("meter") || uom.includes("metre")) return "per_meter";
  if (uom.includes("day")) return "per_day";
  if (uom.includes("unit") || uom.includes("each") || uom.includes("pc")) return "per_unit";
  return "lump_sum";
}

function buildPmsMeta(row: V41PmsUploadRow) {
  return {
    v41PmsUpload: {
      machinery: row.machinery,
      component: row.component,
      jobHeading: row.jobHeading,
      jobDescription: row.jobDescription,
      frequencyType: row.frequencyType,
      frequencyInterval: row.frequencyInterval,
      jobType: row.jobType,
      responsibleRankPic: row.responsibleRankPic,
      verifyingAuthority: row.verifyingAuthority,
      vesselTypeApplicability: row.vesselTypeApplicability,
      criticality: row.criticality,
      sourceModule: row.sourceModule,
      duplicateGroupId: row.duplicateGroupId,
      validationStatus: row.validationStatus,
      activeFlag: row.activeFlag,
      importedAt: new Date().toISOString(),
    },
  };
}

function buildDryDockRfqMeta(row: V41DryDockRfqRow) {
  return {
    v41DryDockRfq: {
      rfqGroup: row.rfqGroup,
      machinerySystem: row.machinerySystem,
      jobScope: row.jobScope,
      uom: row.uom,
      quantityBasis: row.quantityBasis,
      yardOwnerMakerResponsibility: row.yardOwnerMakerResponsibility,
      inspectionRequirement: row.inspectionRequirement,
      testRequirement: row.testRequirement,
      classAttendance: row.classAttendance,
      remarks: row.remarks,
      importedAt: new Date().toISOString(),
    },
  };
}

function mergeMtilMeta(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
}

type ImportBatch = {
  pmsRows: V41PmsUploadRow[];
  dryDockRfqRows: V41DryDockRfqRow[];
  budgetRows: V41BudgetMappingRow[];
};

function selectBatch(data: V41ParsedUploadWorkbook, options: V41ImportOptions): ImportBatch {
  const limit = options.limit;
  return {
    pmsRows: limit ? data.pmsRows.slice(0, limit) : data.pmsRows,
    dryDockRfqRows: limit ? data.dryDockRfqRows.slice(0, limit) : data.dryDockRfqRows,
    budgetRows: limit ? data.budgetRows.slice(0, limit) : data.budgetRows,
  };
}

async function loadExistingJobIds(jobIds: string[]): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set();
  const chunkSize = 5000;
  const found = new Set<string>();
  for (let i = 0; i < jobIds.length; i += chunkSize) {
    const chunk = jobIds.slice(i, i + chunkSize);
    const rows = await prisma.masterJobLibrary.findMany({
      where: { jobId: { in: chunk } },
      select: { jobId: true },
    });
    for (const row of rows) found.add(row.jobId);
  }
  return found;
}

async function computeDbCoverage(batch: ImportBatch) {
  const [pmsJobsInDb, rfqJobsInDb, budgetJobsInDb] = await Promise.all([
    loadExistingJobIds(batch.pmsRows.map((r) => r.canonicalJobId)),
    loadExistingJobIds(batch.dryDockRfqRows.map((r) => r.canonicalJobId)),
    loadExistingJobIds(batch.budgetRows.map((r) => r.canonicalJobId)),
  ]);
  return {
    pmsJobsInDb: pmsJobsInDb.size,
    rfqJobsInDb: rfqJobsInDb.size,
    budgetJobsInDb: budgetJobsInDb.size,
    existingIds: new Set([...pmsJobsInDb, ...rfqJobsInDb, ...budgetJobsInDb]),
  };
}

type ApplyCounts = {
  pmsMetadata: number;
  dryDockRfqMetadata: number;
  budgetMappings: number;
  masterJobUpdates: number;
  skipped: {
    blockedPms: number;
    inactivePms: number;
    unknownJobIds: number;
  };
};

async function applyImportBatch(
  batch: ImportBatch,
  existingJobIds: Set<string>,
  options: V41ImportOptions,
): Promise<ApplyCounts> {
  const counts: ApplyCounts = {
    pmsMetadata: 0,
    dryDockRfqMetadata: 0,
    budgetMappings: 0,
    masterJobUpdates: 0,
    skipped: { blockedPms: 0, inactivePms: 0, unknownJobIds: 0 },
  };

  const jobMetaCache = new Map<
    string,
    { jobLibraryNodeId: string | null; workshop: string; mtilMeta: unknown }
  >();

  async function loadJob(jobId: string) {
    let cached = jobMetaCache.get(jobId);
    if (cached) return cached;
    const job = await prisma.masterJobLibrary.findUnique({
      where: { jobId },
      select: { jobLibraryNodeId: true, workshop: true, jobLibraryNode: { select: { mtilMeta: true } } },
    });
    if (!job) return null;
    cached = {
      jobLibraryNodeId: job.jobLibraryNodeId,
      workshop: job.workshop,
      mtilMeta: job.jobLibraryNode?.mtilMeta ?? null,
    };
    jobMetaCache.set(jobId, cached);
    return cached;
  }

  for (const row of batch.pmsRows) {
    if (options.skipBlocked !== false && row.validationStatus === "Blocked") {
      counts.skipped.blockedPms++;
      continue;
    }
    if (!row.activeFlag) {
      counts.skipped.inactivePms++;
      continue;
    }
    if (!existingJobIds.has(row.canonicalJobId)) {
      counts.skipped.unknownJobIds++;
      continue;
    }

    const job = await loadJob(row.canonicalJobId);
    if (!job?.jobLibraryNodeId) continue;

    const merged = mergeMtilMeta(job.mtilMeta, buildPmsMeta(row));
    await prisma.jobLibraryNode.update({
      where: { id: job.jobLibraryNodeId },
      data: { mtilMeta: merged },
    });
    job.mtilMeta = merged;
    counts.pmsMetadata++;
  }

  for (const row of batch.dryDockRfqRows) {
    if (!existingJobIds.has(row.canonicalJobId)) {
      counts.skipped.unknownJobIds++;
      continue;
    }

    const job = await loadJob(row.canonicalJobId);
    if (!job?.jobLibraryNodeId) continue;

    const merged = mergeMtilMeta(job.mtilMeta, buildDryDockRfqMeta(row));
    await prisma.jobLibraryNode.update({
      where: { id: job.jobLibraryNodeId },
      data: { mtilMeta: merged },
    });
    job.mtilMeta = merged;
    counts.dryDockRfqMetadata++;
  }

  const rfqByJobId = new Map(batch.dryDockRfqRows.map((r) => [r.canonicalJobId, r]));

  for (const row of batch.budgetRows) {
    if (!existingJobIds.has(row.canonicalJobId)) {
      counts.skipped.unknownJobIds++;
      continue;
    }

    const job = await loadJob(row.canonicalJobId);
    if (!job) continue;

    const rfq = rfqByJobId.get(row.canonicalJobId);
    const mappingId = resolveMappingId(row.canonicalJobId);
    const payload = {
      jobId: row.canonicalJobId,
      rfqSection: row.rfqSection,
      quoteComparisonSection: row.quoteComparisonSection,
      budgetCategory: row.budgetCategory,
      costCode: row.costCode,
      workshop: workshopLabel(job.workshop),
      pricingBasis: rfq ? inferPricingBasis(rfq) : ("lump_sum" as JobPricingBasis),
      discountApplicable: false,
      netItemFlag: false,
    };

    await prisma.jobRfqBudgetMapping.upsert({
      where: { mappingId },
      create: { mappingId, ...payload },
      update: payload,
    });
    counts.budgetMappings++;

    await prisma.masterJobLibrary.update({
      where: { jobId: row.canonicalJobId },
      data: {
        dryDockCostCode: row.costCode,
        rfqCategory: row.rfqSection,
        budgetCategory: row.budgetCategory,
      },
    });
    counts.masterJobUpdates++;
  }

  return counts;
}

export async function importV41UploadReadyFromParsed(
  data: V41ParsedUploadWorkbook,
  options: V41ImportOptions = {},
): Promise<V41ImportResult> {
  const mode = options.mode ?? "dry-run";
  const batch = selectBatch(data, options);

  try {
    const allJobIds = [
      ...new Set([
        ...batch.pmsRows.map((r) => r.canonicalJobId),
        ...batch.dryDockRfqRows.map((r) => r.canonicalJobId),
        ...batch.budgetRows.map((r) => r.canonicalJobId),
      ]),
    ];
    const dbCoverage = await computeDbCoverage(batch);
    const validation = validateV41UploadReady(data);

    if (!validation.valid) {
      return {
        ok: false,
        mode,
        filePath: data.filePath,
        exportVersion: data.exportVersion,
        validation,
        parsed: { sheetRowCounts: data.sheetRowCounts },
        error: `Validation failed with ${validation.errors.length} error(s).`,
      };
    }

    const eligiblePms = batch.pmsRows.filter((r) => {
      if (options.skipBlocked !== false && r.validationStatus === "Blocked") return false;
      if (!r.activeFlag) return false;
      return dbCoverage.existingIds.has(r.canonicalJobId);
    });

    const eligibleRfq = batch.dryDockRfqRows.filter((r) =>
      dbCoverage.existingIds.has(r.canonicalJobId),
    );
    const eligibleBudget = batch.budgetRows.filter((r) =>
      dbCoverage.existingIds.has(r.canonicalJobId),
    );

    const skipped = {
      blockedPms: batch.pmsRows.filter((r) => r.validationStatus === "Blocked").length,
      inactivePms: batch.pmsRows.filter((r) => !r.activeFlag).length,
      unknownJobIds: allJobIds.filter((id) => !dbCoverage.existingIds.has(id)).length,
    };

    if (mode === "dry-run") {
      return {
        ok: true,
        mode,
        filePath: data.filePath,
        exportVersion: data.exportVersion,
        validation,
        parsed: { sheetRowCounts: data.sheetRowCounts },
        dryRun: {
          wouldImport: {
            pmsMetadata: eligiblePms.length,
            dryDockRfqMetadata: eligibleRfq.length,
            budgetMappings: eligibleBudget.length,
            masterJobUpdates: eligibleBudget.length,
          },
          skipped,
          dbCoverage: {
            pmsJobsInDb: dbCoverage.pmsJobsInDb,
            rfqJobsInDb: dbCoverage.rfqJobsInDb,
            budgetJobsInDb: dbCoverage.budgetJobsInDb,
          },
        },
      };
    }

    const runApply = () => applyImportBatch(batch, dbCoverage.existingIds, options);

    let applied: ApplyCounts;
    let rolledBack = false;

    if (options.rollback) {
      applied = await prisma.$transaction(async () => {
        const counts = await runApply();
        throw { __v41Rollback: true, counts };
      }).catch((err: unknown) => {
        if (err && typeof err === "object" && "__v41Rollback" in err) {
          rolledBack = true;
          return (err as { counts: ApplyCounts }).counts;
        }
        throw err;
      });
    } else {
      applied = await runApply();
    }

    return {
      ok: true,
      mode,
      filePath: data.filePath,
      exportVersion: data.exportVersion,
      validation,
      parsed: { sheetRowCounts: data.sheetRowCounts },
      applied: {
        pmsMetadata: applied.pmsMetadata,
        dryDockRfqMetadata: applied.dryDockRfqMetadata,
        budgetMappings: applied.budgetMappings,
        masterJobUpdates: applied.masterJobUpdates,
        rolledBack,
      },
      dryRun: rolledBack
        ? {
            wouldImport: {
              pmsMetadata: eligiblePms.length,
              dryDockRfqMetadata: eligibleRfq.length,
              budgetMappings: eligibleBudget.length,
              masterJobUpdates: eligibleBudget.length,
            },
            skipped,
            dbCoverage: {
              pmsJobsInDb: dbCoverage.pmsJobsInDb,
              rfqJobsInDb: dbCoverage.rfqJobsInDb,
              budgetJobsInDb: dbCoverage.budgetJobsInDb,
            },
          }
        : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "V4.1 import failed";
    return {
      ok: false,
      mode,
      filePath: data.filePath,
      exportVersion: data.exportVersion,
      validation: validateV41UploadReady(data),
      parsed: { sheetRowCounts: data.sheetRowCounts },
      error: message,
    };
  }
}

export async function importV41UploadReadyFromPath(
  filePath: string,
  options: V41ImportOptions = {},
): Promise<V41ImportResult> {
  const data = parseV41UploadReadyFile(filePath);
  return importV41UploadReadyFromParsed(data, options);
}

export async function importV41UploadReadyFromBuffer(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  options: V41ImportOptions & { filePath?: string } = {},
): Promise<V41ImportResult> {
  const data = parseV41UploadReadyBuffer(buffer, options.filePath ?? "<buffer>");
  return importV41UploadReadyFromParsed(data, options);
}

export function resolveV41UploadReadyPath(customPath?: string): string {
  if (customPath) return customPath;
  if (fs.existsSync(EMDR_V41_EXPORT_REPO_PATH)) return EMDR_V41_EXPORT_REPO_PATH;
  if (fs.existsSync(EMDR_V41_EXPORT_DOWNLOADS_PATH)) return EMDR_V41_EXPORT_DOWNLOADS_PATH;
  throw new Error(
    `V4.1 upload-ready workbook not found. Expected at ${EMDR_V41_EXPORT_REPO_PATH} or ${EMDR_V41_EXPORT_DOWNLOADS_PATH}`,
  );
}
