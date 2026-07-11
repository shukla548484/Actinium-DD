import * as XLSX from "xlsx";
import fs from "node:fs";
import type { ParsedComponentMasterRow, ParsedEquipmentMasterRow } from "@/lib/emdr/types";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import {
  synthesizeV3ScopeSteps,
  synthesizeV3Templates,
  synthesizeV3Workflows,
  type V3RepositoryIndexRow,
} from "@/lib/emdr/v3/parseV3Rows";
import { EMDR_V312_RELEASE } from "@/lib/emdr/v3/sheets";
import { normalizeWorkbookMasterIds } from "@/lib/mtil/import/normalizeWorkbookMasterIds";
import type {
  ParsedChecklistRow,
  ParsedMasterJobRow,
  ParsedMeasurementRow,
  ParsedMtilWorkbook,
  ParsedRfqRow,
} from "@/lib/mtil/import/parseWorkbook";
import { cellStr, mapInputType, mapPricingBasis } from "@/lib/mtil/import/excelValues";
import { MASTER_ENTITY_CODES, normalizeMasterId } from "@/lib/mtil/masterCodeStandard";
import { parseMasterJobs } from "@/lib/mtil/v2/import/parseSprintRows";

const MASTER_SHEET = "PMS_Jobs";

export const V323_FLS_MACHINERY_FAMILY = "Fire Fighting & Life Saving Safety Systems";

const FFS_JOB_CODE_PATTERN = /^FFS-\d+$/i;

export function isV323TypewiseFfsJobId(jobId: string): boolean {
  return /^JOBS-FFS-\d+$/i.test(jobId);
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV323FireLsaSafetyWorkbook(workbook: XLSX.WorkBook): boolean {
  if (!workbook.SheetNames.includes(MASTER_SHEET)) return false;
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]).replace(/^JOBS-/, "");
  if (!FFS_JOB_CODE_PATTERN.test(code)) return false;
  const family = cellStr(rows[0]?.["Machinery Family"]);
  return /fire fighting.*life saving|life saving.*fire fighting/i.test(family);
}

export function normalizeV323FfsJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (!FFS_JOB_CODE_PATTERN.test(code)) return "";
  return `JOBS-${code.toUpperCase()}`;
}

function idsFromJobId(jobId: string) {
  const tail = jobId.replace(/^JOBS-/, "");
  return {
    templateId: `TMPL-${tail}`,
    measurementSetId: `MEAS-${tail}`,
    inspectionChecklistId: `INSP-${tail}`,
    scopeOfWorkId: `SCOP-${tail}`,
  };
}

function slug(value: string, max = 24): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
}

function systemCodeForSystemName(name: string, index: number): string {
  const base = slug(name, 20).toUpperCase().replace(/_/g, "-") || `SYS-${index + 1}`;
  return `FFS-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw) return false;
  return raw.includes("dry dock") || raw.includes("class survey");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const criticality = cellStr(row["Criticality"]);
  if (/^(low|medium|high|critical)$/i.test(criticality)) return criticality;
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  return cellStr(row["Job Heading"]) || cellStr(row["Job Type"]);
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"]);
  const heading = cellStr(row["Job Heading"]);
  if (!desc || desc.length < 12) return heading || desc;
  return desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"]);
  if (!pic) return "Safety Officer";
  const lower = pic.toLowerCase();
  if (lower.includes("electrician") || /\beto\b/.test(lower)) return "Electrical Officer";
  if (lower.includes("safety officer")) return "Safety Officer / Second Engineer";
  if (lower.includes("fourth engineer")) return "Fourth Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System / Equipment"]);
  if (system) return system;
  const equipmentType = cellStr(row["Equipment Type / Variant"]);
  if (equipmentType) return equipmentType;
  return V323_FLS_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const component = cellStr(row["Component / Location"]);
  if (component) return component;
  const equipmentType = cellStr(row["Equipment Type / Variant"]);
  return equipmentType || "Fire / Life Saving Equipment";
}

function departmentFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System / Equipment"]).toLowerCase();
  if (/lifeboat|rescue boat|life raft|davit|emergency lighting|escape route/i.test(system)) {
    return "Deck";
  }
  if (/alarm|detection|lighting|electric/i.test(system)) return "Electrical";
  if (/fireman's|breathing apparatus|safety drill/i.test(system)) return "Deck";
  return "Engine";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System / Equipment"]).toLowerCase();
  if (/lifeboat|rescue boat|life raft/i.test(system)) return "lifeboat station";
  if (/portable|blanket/i.test(system)) return "fire station / deck";
  return "engine room / fire fighting systems";
}

function componentTypeFromSystem(systemName: string): string {
  if (/lifeboat|rescue boat|life raft|davit/i.test(systemName)) return "Life Saving";
  if (/fire|co2|foam|sprinkler|drencher|extinguish/i.test(systemName)) return "Fire Fighting";
  if (/alarm|detection|lighting/i.test(systemName)) return "Safety Systems";
  return "Fire / Life Saving";
}

function normalizeV323FfsJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.flatMap((row) => {
    const jobId = normalizeV323FfsJobCode(cellStr(row["Job Code"]));
    if (!jobId) return [];

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V323_FLS_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Operational / Dry Dock"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: /fire fighting.*life saving|life saving.*fire fighting/i.test(machinery)
          ? V323_FLS_MACHINERY_FAMILY
          : machinery,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": "All Types",
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: workshopFromRow(row),
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": V323_FLS_MACHINERY_FAMILY,
        "Budget Category": systemName,
        "Cost Code": `DD-${systemCode}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks: cellStr(row["Remarks"]) || cellStr(row["Duplicate / Cross Reference"]) || null,
      },
    ];
  });
}

function synthesizeV323FfsMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      measurementId: `${ids.measurementSetId}-01`,
      measurementSetId: ids.measurementSetId,
      templateId: job.templateId,
      measurementName: "Job completion record",
      unit: "—",
      minLimit: null,
      maxLimit: null,
      targetValue: null,
      inputType: mapInputType("text"),
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV323FfsChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      checklistItemId: `${ids.inspectionChecklistId}-01`,
      checklistId: ids.inspectionChecklistId,
      templateId: job.templateId,
      sequenceNo: 1,
      inspectionItem: job.standardJobName,
      acceptanceCriteria:
        job.jobDescription || "Complete per SOLAS, FSS Code, maker manual and PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV323FfsRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || "Fire / Life Saving Safety";
    return {
      rowNumber: index + 2,
      mappingId: `RFQM-${job.jobId.replace(/^JOBS-/, "")}`,
      jobId: job.jobId,
      rfqSection: budgetCategory,
      quoteComparisonSection: budgetCategory,
      budgetCategory,
      costCode: budgetCategory,
      workshop: job.workshop,
      pricingBasis: mapPricingBasis("lump_sum"),
      discountApplicable: false,
      netItemFlag: false,
    };
  });
}

function synthesizeV323FfsEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
  const seen = new Set<string>();
  const rows: ParsedEquipmentMasterRow[] = [];
  for (const [index, job] of jobs.entries()) {
    const equipmentCode = job.subComponent;
    if (!equipmentCode || seen.has(equipmentCode)) continue;
    seen.add(equipmentCode);
    rows.push({
      rowNumber: index + 2,
      equipmentCode,
      machinery: job.machinery,
      system: job.systemGroup,
      equipmentComponent: job.systemGroup,
      department: departmentFromRow({ "System / Equipment": job.systemGroup }),
      vesselType: "All Types",
      remarks: null,
    });
  }
  return rows;
}

function synthesizeV323FfsComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
  const seen = new Set<string>();
  const rows: ParsedComponentMasterRow[] = [];
  for (const [index, job] of jobs.entries()) {
    const componentKey = `${job.subComponent ?? ""}:${job.component}`;
    if (!componentKey || seen.has(componentKey)) continue;
    seen.add(componentKey);
    const componentCode = normalizeMasterId(
      `COMP-${slug(`${job.systemGroup}-${job.component}`, 40).toUpperCase()}`,
      MASTER_ENTITY_CODES.COMP,
    );
    rows.push({
      rowNumber: index + 2,
      componentCode,
      equipmentCode: job.subComponent ?? "",
      componentName: job.component,
      componentType: componentTypeFromSystem(job.systemGroup),
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV323FfsRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
  const bySystem = new Map<string, { systemName: string; count: number }>();
  for (const job of jobs) {
    const systemName = job.systemGroup;
    if (!systemName) continue;
    const entry = bySystem.get(systemName) ?? { systemName, count: 0 };
    entry.count += 1;
    bySystem.set(systemName, entry);
  }
  return [...bySystem.entries()].map(([systemName, entry], index) => ({
    systemCode: systemCodeForSystemName(systemName, index),
    systemName: entry.systemName,
    jobCount: entry.count,
    status: "Completed",
    machineryFamily: V323_FLS_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV323FireLsaSafetyRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV323FireLsaSafetyWorkbook(workbook)) {
    throw new Error(
      "Not a V3.23 Fire Fighting / Life Saving / Safety Systems EMDR repository workbook",
    );
  }

  const jobRows = normalizeV323FfsJobRows(sheetRows(workbook, MASTER_SHEET));
  const masterJobs = parseMasterJobs(jobRows).map((job) => ({
    ...job,
    libraryVersion: EMDR_V312_RELEASE,
  }));

  const templates = synthesizeV3Templates(masterJobs);
  const workflows = synthesizeV3Workflows(templates, masterJobs);
  const scopeSteps = synthesizeV3ScopeSteps(masterJobs);

  const parsed: ParsedMtilWorkbook = {
    libraryVersion: EMDR_V312_RELEASE,
    masterJobs,
    templates,
    measurements: synthesizeV323FfsMeasurements(masterJobs),
    checklistItems: synthesizeV323FfsChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV323FfsRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV323FfsEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV323FfsComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV323FfsRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV323FireLsaSafetyRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV323FireLsaSafetyRepositoryBuffer(bytes);
}

export function parseV323FireLsaSafetyRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV323FireLsaSafetyRepositoryFile(path);
  } catch {
    return null;
  }
}
