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

const MASTER_SHEET_CANDIDATES = [
  "Jobs",
  "Job_Register",
  "Jobs_Repository",
  "Job_Repository",
  "PMS_Repository",
  "Job_List",
  "PMS_Jobs",
  "Class_Statutory_Jobs",
] as const;

export const V340_CSST_MACHINERY_FAMILY =
  "Class / Statutory / Certification / Survey Test Package";

const CSST_JOB_CODE_PATTERN = /^CSST-\d+$/i;

export function isV340TypewiseCsstJobId(jobId: string): boolean {
  return /^JOBS-CSST-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /class|statutory|certification|survey|job.?register|^jobs$/i.test(name),
    ) ?? null
  );
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  let headerIdx = -1;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map((cell) => cellStr(cell));
    if (cells.includes("Job Code") && cells.includes("Job Heading")) {
      headerIdx = i;
      break;
    }
    if (cells.includes("Repository Version") && cells.includes("Job Heading")) {
      headerIdx = i;
      break;
    }
    if (
      cells.includes("Job Code") ||
      (cells.includes("Job Heading") &&
        (cells.includes("Phase / Section") || cells.includes("Phase") || cells.includes("Section")))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const headers = (matrix[headerIdx] as unknown[]).map((cell) => cellStr(cell));
  const rows: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const record: Record<string, unknown> = {};
    let hasContent = false;
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      const value = row[j] ?? "";
      if (value !== "" && value !== null && value !== undefined) hasContent = true;
      record[key] = value;
    }
    if (hasContent) rows.push(record);
  }
  return rows;
}

function versionLogIndicatesV340(workbook: XLSX.WorkBook): boolean {
  const versionLog = workbook.Sheets.Version_Log;
  if (!versionLog) return false;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(versionLog, { header: 1, defval: "" });
  return matrix.some(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => /V3\.40/i.test(cellStr(cell)) && /class|statutory|survey/i.test(cellStr(cell))),
  );
}

function titleIndicatesV340(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return false;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return matrix.some(
    (row) =>
      Array.isArray(row) &&
      row.some(
        (cell) =>
          /V3\.40/i.test(cellStr(cell)) &&
          /class.*statutory|statutory.*certification|survey test package/i.test(cellStr(cell)),
      ),
  );
}

export function isV340ClassStatutoryWorkbook(workbook: XLSX.WorkBook): boolean {
  if (versionLogIndicatesV340(workbook) || titleIndicatesV340(workbook)) return true;
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = jobCodeSourceFromRow(row);
    const section = cellStr(row["Section"] ?? row["Phase / Section"] ?? row["System Group"]);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    const version = cellStr(row["Repository Version"]);
    return (
      /^V3\.40/i.test(version) ||
      /^V3\.40-/i.test(jobCode) ||
      /^CSST-\d+$/i.test(jobCode) ||
      /class hull survey|class tank survey|marpol|solas|radio.*navigation|load test|pressure test|certificate.*documentation/i.test(
        `${section} ${equipment}`,
      )
    );
  });
}

export function normalizeV340CsstJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (CSST_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v340Prefixed = /^V3\.40-CSST-(\d+)$/i.exec(code);
  if (v340Prefixed) return `JOBS-CSST-${v340Prefixed[1].padStart(4, "0")}`;
  const v340Section = /^V3\.40-[A-Z0-9-]+-(\d+)$/i.exec(code);
  if (v340Section) return `JOBS-CSST-${v340Section[1].padStart(4, "0")}`;
  const v340Plain = /^V3\.40-(\d+)$/i.exec(code);
  if (v340Plain) return `JOBS-CSST-${v340Plain[1].padStart(4, "0")}`;
  return "";
}

function formatCsstJobCode(sequence: number): string {
  return `JOBS-CSST-${String(sequence).padStart(4, "0")}`;
}

function jobCodeSourceFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Job Code"]);
  if (explicit) return explicit;
  const remarks = cellStr(row["Remarks"]);
  if (CSST_JOB_CODE_PATTERN.test(remarks)) return remarks;
  return "";
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
  return `CSST-${base}`;
}

function dryDockFlag(row: Record<string, unknown>): boolean {
  const phase = cellStr(
    row["Dry Dock Phase"] ??
      row["Dry-Dock Scope"] ??
      row["Dry-Dock / Shipyard Scope"] ??
      row["Dry Dock Scope"] ??
      row["Dry Dock / PMS"] ??
      row["Dry-Dock / PMS"],
  );
  if (/^yes$/i.test(phase)) return true;
  if (/docking|survey|repair|verification|class|statutory|pressure.?test|hydro|load test/i.test(phase)) {
    return true;
  }
  const section = cellStr(row["Section"]).toLowerCase();
  if (/class hull|class tank|load test|pressure test|certificate/i.test(section)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Risk / Criticality"] ?? row["Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  const section = cellStr(row["Section"]).toLowerCase();
  if (/solas|marpol|pressure test|load test/i.test(section)) return "High";
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  const component = cellStr(row["Component"]);
  if (heading && equipment) return `${equipment} — ${heading}`;
  if (heading && component) return `${component} — ${heading}`;
  return heading || equipment || component;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const heading = cellStr(row["Job Heading"]);
  const evidence = cellStr(row["Evidence Required"]);
  if (desc && desc.length >= 12) {
    return evidence ? `${desc} Evidence: ${evidence}` : desc;
  }
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(
    row["PIC"] ?? row["Responsibility"] ?? row["Responsible Rank / Dept"] ?? row["Responsible Rank"],
  );
  if (!pic) return "Chief Engineer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("radio officer")) return "Electrical Officer";
  if (lower.includes("technical superintendent") || lower.includes("superintendent")) {
    return "Chief Engineer";
  }
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("class surveyor") || lower.includes("class / flag")) return "Chief Engineer";
  if (lower.includes("service engineer")) return "Fourth Engineer";
  if (lower.includes("shipyard")) return "Chief Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsibility"]).toLowerCase();
  const section = cellStr(row["Section"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${section} ${equipment}`;
  if (/\beto\b/.test(pic) || pic.includes("radio officer") || /radio|navigation|gmdss|vdr|epirb/i.test(combined)) {
    return "Electrical";
  }
  if (/class hull|load test|lifting|gangway|davit|crane|mooring/i.test(combined)) return "Deck";
  if (/certificate|documentation|survey defect/i.test(combined)) return "Deck";
  if (pic.includes("chief officer") || pic.includes("bosun")) return "Deck";
  if (pic.includes("chief engineer") || pic.includes("engineer")) return "Engine";
  if (/marpol|pressure test|solas|tank survey/i.test(combined)) return "Engine";
  return "Engine";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"] ?? row["Phase / Section"] ?? row["System Group"]);
  if (section) return section;
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  if (equipment) return equipment;
  return V340_CSST_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  const component = cellStr(row["Component"]);
  const jobType = cellStr(row["Job Type"] ?? row["Job Action"] ?? row["Action Code"]);
  const parts = [equipment, component, jobType].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Class / Statutory Survey Item";
}

function vesselTypesFromRow(row: Record<string, unknown>): string {
  const vesselType = cellStr(row["Ship Type Applicability"] ?? row["Vessel Type"]);
  if (
    !vesselType ||
    /all vessels|all vessel types|all \/ applicable|all applicable|esp.*all applicable/i.test(vesselType)
  ) {
    return "All Types";
  }
  return vesselType;
}

function workshopFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${section} ${equipment}`;
  if (/radio|navigation|gmdss|vdr|electrical/i.test(combined)) return "electrical workshop";
  if (/class hull|load test|lifting|gangway|davit|crane/i.test(combined)) return "deck workshop";
  if (/certificate|documentation/i.test(combined)) return "shipyard office";
  if (/pressure test|hydro|air bottle|steam/i.test(combined)) return "machinery workshop";
  return "survey contractor";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/hull|utm|close-up|ndt|steel renewal/i.test(combined)) return "Hull Survey Control";
  if (/tank|esp|pressure test|leak test/i.test(combined)) return "Tank Survey Control";
  if (/marpol|ows|odme|stp|bwts|incinerator/i.test(combined)) return "MARPOL Statutory Control";
  if (/solas|fire|life saving|scba|eebd/i.test(combined)) return "SOLAS Statutory Control";
  if (/radio|gmdss|vdr|epirb|ais|lrith/i.test(combined)) return "Radio / Navigation Statutory Control";
  if (/load test|proof load|lifting/i.test(combined)) return "Load Test / Lifting Certification";
  if (/pressure|hydro|air bottle|accumulator/i.test(combined)) return "Pressure Vessel / Hydro Test";
  if (/certificate|documentation|survey defect/i.test(combined)) return "Certificate / Documentation Control";
  return "Class / Statutory Survey Item";
}

function normalizeV340CsstJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const sourceCode = jobCodeSourceFromRow(row);
    const explicitCode = normalizeV340CsstJobCode(sourceCode);
    sequence += 1;
    let jobId = explicitCode || formatCsstJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatCsstJobCode(sequence);
    }
    seenJobIds.add(jobId);

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const dryDock = dryDockFlag(row);
    const crossRef = cellStr(row["Cross Reference Module"] ?? row["Duplicate Control / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ Group"] ?? row["RFQ Scope"] ?? row["RFQ / Cost Mapping"]);
    const remarksText = cellStr(row["Remarks"]);
    const remarksIsCode = CSST_JOB_CODE_PATTERN.test(remarksText);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V340_CSST_MACHINERY_FAMILY,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": vesselTypesFromRow(row),
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: workshopFromRow(row),
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": rfqNote || V340_CSST_MACHINERY_FAMILY,
        "Budget Category": equipment || systemName,
        "Cost Code": `DD-CSST-${systemCode.replace(/^CSST-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": /maker|service engineer|class surveyor/i.test(cellStr(row["Verifying Authority"]))
          ? "Y"
          : "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks:
          (!remarksIsCode && remarksText) ||
          crossRef ||
          (sourceCode && !explicitCode ? `Source code: ${sourceCode}` : null) ||
          null,
      },
    ];
  });
}

function synthesizeV340CsstMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      measurementId: `${ids.measurementSetId}-01`,
      measurementSetId: ids.measurementSetId,
      templateId: job.templateId,
      measurementName: "Survey / certificate completion record",
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

function synthesizeV340CsstChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per class rules, flag requirements and company SMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV340CsstRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V340_CSST_MACHINERY_FAMILY;
    return {
      rowNumber: 0,
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

function synthesizeV340CsstEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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
      department: job.department,
      vesselType: "All Types",
      remarks: null,
    });
  }
  return rows;
}

function synthesizeV340CsstComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: componentTypeFromSystem(job.systemGroup, job.component),
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV340CsstRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V340_CSST_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV340ClassStatutoryRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV340ClassStatutoryWorkbook(workbook)) {
    throw new Error(
      "Not a V3.40 Class / Statutory / Certification / Survey Test Package EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.40 Class Statutory workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV340CsstJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV340CsstMeasurements(masterJobs),
    checklistItems: synthesizeV340CsstChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV340CsstRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV340CsstEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV340CsstComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV340CsstRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV340ClassStatutoryRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV340ClassStatutoryRepositoryBuffer(bytes);
}

export function parseV340ClassStatutoryRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV340ClassStatutoryRepositoryFile(path);
  } catch {
    return null;
  }
}
