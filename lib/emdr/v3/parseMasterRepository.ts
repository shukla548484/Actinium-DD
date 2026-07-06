import * as XLSX from "xlsx";
import fs from "node:fs";
import { parseComponentMaster } from "@/lib/emdr/parseSprintMasterSheets";
import type { ParsedEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import { EMDR_V30_RELEASE, EMDR_V34_RELEASE, EMDR_V36_RELEASE, EMDR_V37_RELEASE, EMDR_V38_RELEASE } from "@/lib/emdr/v3/sheets";
import {
  buildTemplateIdByJobId,
  buildV3RepositoryIndex,
  isV34JobSheet,
  normalizeV3JobRows,
  parseV3AeSummary,
  parseV3EquipmentMaster,
  parseV3LibraryVersion,
  parseV3Checklist,
  parseV3Measurements,
  parseV3Rfq,
  parseV3Spares,
  parseV3ToolMaster,
  synthesizeV3ScopeSteps,
  synthesizeV3Templates,
  synthesizeV3Workflows,
} from "@/lib/emdr/v3/parseV3Rows";
import {
  sheetRowsFromCandidates,
  V3_SHEET_CANDIDATES,
} from "@/lib/emdr/v3/resolveWorkbookSheets";
import { normalizeWorkbookMasterIds } from "@/lib/mtil/import/normalizeWorkbookMasterIds";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import {
  parseMasterJobs,
} from "@/lib/mtil/v2/import/parseSprintRows";

export type ParsedV3MasterRepository = ParsedEmdrSprintWorkbook & {
  repositoryIndex: ReturnType<typeof buildV3RepositoryIndex>;
  release: string;
};

function resolveCumulativeLibraryVersion(
  jobRows: Array<Record<string, unknown>>,
  masterJobs: ReturnType<typeof parseMasterJobs>,
): string {
  if (!isV34JobSheet(jobRows)) {
    return masterJobs[0]?.libraryVersion ?? parseV3LibraryVersion(jobRows) ?? EMDR_V30_RELEASE;
  }
  const hasV38Families = masterJobs.some((job) =>
    /fresh water generator|\bfwg\b|air conditioning|refrigeration|\bhvac\b/i.test(job.machinery),
  );
  if (hasV38Families) return EMDR_V38_RELEASE;

  const hasV37Families = masterJobs.some((job) =>
    /steering gear|cargo pumping system|lifting appliances|deck masts|deck heating|cargo tank heating|steam coils|standing rigging/i.test(
      job.machinery,
    ),
  );
  if (hasV37Families) return EMDR_V37_RELEASE;

  const hasV36Families = masterJobs.some(
    (job) =>
      job.jobId.startsWith("JOBS-PUR-") ||
      job.jobId.startsWith("JOB-V36-") ||
      job.jobId.startsWith("JOBS-V36-") ||
      /heat exchanger|purifier|cargo oil pump turbine/i.test(job.machinery),
  );
  return hasV36Families ? EMDR_V36_RELEASE : EMDR_V34_RELEASE;
}

export function parseV3MasterRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  const rawJobRows = sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.jobs]);
  const jobRows = normalizeV3JobRows(rawJobRows);
  const masterJobs = parseMasterJobs(jobRows);
  const libraryVersion = resolveCumulativeLibraryVersion(rawJobRows, masterJobs);

  const normalizedJobs = masterJobs.map((job) => ({
    ...job,
    libraryVersion,
  }));

  const templates = synthesizeV3Templates(normalizedJobs);
  const workflows = synthesizeV3Workflows(templates, normalizedJobs);
  const scopeSteps = synthesizeV3ScopeSteps(normalizedJobs);
  const templateIdByJobId = buildTemplateIdByJobId(normalizedJobs);

  const parsed: ParsedMtilWorkbook = {
    libraryVersion,
    masterJobs: normalizedJobs,
    templates,
    measurements: parseV3Measurements(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.measurements]),
      templateIdByJobId,
    ),
    checklistItems: parseV3Checklist(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.inspections]),
      templateIdByJobId,
    ),
    scopeSteps,
    attachments: [],
    spares: parseV3Spares(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.spares]),
      templateIdByJobId,
    ),
    rfqMappings: parseV3Rfq(sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.rfq])),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);
  const emdrMasterData = {
    equipmentMaster: parseV3EquipmentMaster(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.equipment]),
    ),
    componentMaster: parseComponentMaster(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.components]),
    ),
    tools: parseV3ToolMaster(
      sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.tools]),
      templateIdByJobId,
    ),
  };

  return {
    ...normalized,
    emdrMasterData,
    repositoryIndex: [
      ...buildV3RepositoryIndex(
        sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.repositoryIndex]),
      ),
      ...parseV3AeSummary(sheetRowsFromCandidates(workbook, [...V3_SHEET_CANDIDATES.aeSummary])),
    ],
    release: libraryVersion,
  };
}

export function parseV3MasterRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV3MasterRepositoryBuffer(bytes);
}

export function parseV3MasterRepositoryFileIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV3MasterRepositoryFile(path);
  } catch {
    return null;
  }
}
