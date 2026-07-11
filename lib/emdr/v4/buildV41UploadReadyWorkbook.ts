import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { loadEmdrMasterRepositoryParsed } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import { V41_EXPORT_VERSION } from "@/lib/emdr/v4/constants";
import {
  loadV40MetadataOverlay,
  resolveV40OverlayForJobId,
  type V40MetadataOverlayIndex,
} from "@/lib/emdr/v4/loadV40MetadataOverlay";
import {
  buildDuplicateContext,
  buildDuplicateControlRows,
  buildImportLookups,
  buildValidationErrorRows,
  buildVesselTypeFilterRows,
  normalizeV41Job,
  toBudgetMappingRow,
  toDryDockRfqRow,
  toPmsUploadRow,
  type V41NormalizedJob,
} from "@/lib/emdr/v4/normalizeV41Jobs";
import {
  EMDR_V41_EXPORT_DOWNLOADS_PATH,
  EMDR_V41_EXPORT_REPO_PATH,
  resolveEmdrV40MetadataOverlayPath,
} from "@/lib/emdr/paths";

export type V41SheetRowCounts = {
  PMS_Upload_Ready: number;
  DryDock_RFQ_Ready: number;
  Budget_Cost_Code_Mapping: number;
  Vessel_Type_Filter: number;
  Duplicate_Control: number;
  Validation_Errors: number;
  Import_Lookups: number;
  Export_Summary: number;
};

export type V41ValidationStats = {
  totalRepoJobs: number;
  normalizedJobs: number;
  v4OverlayMatches: number;
  pass: number;
  warning: number;
  blocked: number;
  pmsRows: number;
  dryDockRfqRows: number;
  duplicateGroups: number;
  duplicateJobs: number;
};

export type V41BuildResult = {
  buffer: Buffer;
  outputPaths: string[];
  sheetRowCounts: V41SheetRowCounts;
  validationStats: V41ValidationStats;
  repoRelease: string;
  overlayPath: string | null;
};

export type BuildV41UploadReadyWorkbookOptions = {
  v40OverlayPath?: string;
  outputPaths?: string[];
};

function appendSheet(workbook: XLSX.WorkBook, sheetName: string, rows: Array<Record<string, string | number>>) {
  const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[]]);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function buildExportSummaryRows(
  stats: V41ValidationStats,
  repoRelease: string,
  overlayPath: string | null,
  sheetRowCounts: V41SheetRowCounts,
): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = [
    { Metric: "Export Version", Value: V41_EXPORT_VERSION },
    { Metric: "Generated At (UTC)", Value: new Date().toISOString() },
    { Metric: "Repo Release", Value: repoRelease },
    { Metric: "V4 Overlay Path", Value: overlayPath ?? "Not found" },
    { Metric: "Total Repo Jobs", Value: stats.totalRepoJobs },
    { Metric: "Normalized Jobs", Value: stats.normalizedJobs },
    { Metric: "V4 Overlay Matches", Value: stats.v4OverlayMatches },
    { Metric: "Validation Pass", Value: stats.pass },
    { Metric: "Validation Warning", Value: stats.warning },
    { Metric: "Validation Blocked", Value: stats.blocked },
    { Metric: "PMS Upload Rows", Value: stats.pmsRows },
    { Metric: "Dry Dock RFQ Rows", Value: stats.dryDockRfqRows },
    { Metric: "Duplicate Groups", Value: stats.duplicateGroups },
    { Metric: "Duplicate Jobs", Value: stats.duplicateJobs },
  ];
  for (const [sheet, count] of Object.entries(sheetRowCounts)) {
    rows.push({ Metric: `Sheet Rows — ${sheet}`, Value: count });
  }
  return rows;
}

function isEligibleForPms(job: V41NormalizedJob): boolean {
  return job.routes.includes("PMS") && job.validationStatus !== "Blocked" && job.isDuplicateKeeper;
}

function isEligibleForDryDockRfq(job: V41NormalizedJob): boolean {
  return (
    (job.routes.includes("Dry Dock") || job.routes.includes("Statutory")) &&
    job.validationStatus !== "Blocked" &&
    job.isDuplicateKeeper
  );
}

function writeOutputs(buffer: Buffer, outputPaths: string[]) {
  for (const target of outputPaths) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
  }
}

export function buildV41UploadReadyWorkbook(
  options: BuildV41UploadReadyWorkbookOptions = {},
): V41BuildResult {
  const parsed = loadEmdrMasterRepositoryParsed();
  if (!parsed) {
    throw new Error("EMDR master repository not found or failed to parse. Ensure V3.x workbooks are present under data/emdr/v2.");
  }

  const overlayPath = options.v40OverlayPath ?? resolveEmdrV40MetadataOverlayPath();
  const overlayIndex: V40MetadataOverlayIndex | null = loadV40MetadataOverlay(overlayPath);

  const overlayByJobId = new Map(
    parsed.masterJobs
      .map((job) => {
        const overlay = resolveV40OverlayForJobId(overlayIndex, job.jobId);
        return overlay ? ([job.jobId, overlay] as const) : null;
      })
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof resolveV40OverlayForJobId>>] => entry !== null),
  );

  const duplicateContext = buildDuplicateContext(parsed.masterJobs, overlayByJobId);
  const normalizedJobs = parsed.masterJobs.map((job) =>
    normalizeV41Job(job, overlayByJobId.get(job.jobId), duplicateContext),
  );

  const pmsRows = normalizedJobs.filter(isEligibleForPms).map(toPmsUploadRow);
  const dryDockRfqRows = normalizedJobs.filter(isEligibleForDryDockRfq).map(toDryDockRfqRow);
  const budgetRows = normalizedJobs.filter((j) => j.isDuplicateKeeper).map(toBudgetMappingRow);
  const vesselFilterRows = buildVesselTypeFilterRows(normalizedJobs);
  const duplicateControlRows = buildDuplicateControlRows(normalizedJobs);
  const validationErrorRows = buildValidationErrorRows(normalizedJobs);
  const importLookupRows = buildImportLookups(normalizedJobs);

  const validationStats: V41ValidationStats = {
    totalRepoJobs: parsed.masterJobs.length,
    normalizedJobs: normalizedJobs.length,
    v4OverlayMatches: normalizedJobs.filter((j) => j.overlayMatched).length,
    pass: normalizedJobs.filter((j) => j.validationStatus === "Pass").length,
    warning: normalizedJobs.filter((j) => j.validationStatus === "Warning").length,
    blocked: normalizedJobs.filter((j) => j.validationStatus === "Blocked").length,
    pmsRows: pmsRows.length,
    dryDockRfqRows: dryDockRfqRows.length,
    duplicateGroups: duplicateControlRows.length > 0 ? new Set(duplicateControlRows.map((r) => r.Duplicate_Group_ID)).size : 0,
    duplicateJobs: duplicateControlRows.length,
  };

  const sheetRowCounts: V41SheetRowCounts = {
    PMS_Upload_Ready: pmsRows.length,
    DryDock_RFQ_Ready: dryDockRfqRows.length,
    Budget_Cost_Code_Mapping: budgetRows.length,
    Vessel_Type_Filter: vesselFilterRows.length,
    Duplicate_Control: duplicateControlRows.length,
    Validation_Errors: validationErrorRows.length,
    Import_Lookups: importLookupRows.length,
    Export_Summary: 0,
  };

  const summaryRows = buildExportSummaryRows(validationStats, parsed.release, overlayIndex?.path ?? null, sheetRowCounts);
  sheetRowCounts.Export_Summary = summaryRows.length;

  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, "PMS_Upload_Ready", pmsRows);
  appendSheet(workbook, "DryDock_RFQ_Ready", dryDockRfqRows);
  appendSheet(workbook, "Budget_Cost_Code_Mapping", budgetRows);
  appendSheet(workbook, "Vessel_Type_Filter", vesselFilterRows);
  appendSheet(workbook, "Duplicate_Control", duplicateControlRows);
  appendSheet(workbook, "Validation_Errors", validationErrorRows);
  appendSheet(workbook, "Import_Lookups", importLookupRows);
  appendSheet(workbook, "Export_Summary", summaryRows);

  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  const outputPaths = options.outputPaths ?? [EMDR_V41_EXPORT_REPO_PATH, EMDR_V41_EXPORT_DOWNLOADS_PATH];
  writeOutputs(buffer, outputPaths);

  return {
    buffer,
    outputPaths,
    sheetRowCounts,
    validationStats,
    repoRelease: parsed.release,
    overlayPath: overlayIndex?.path ?? null,
  };
}
