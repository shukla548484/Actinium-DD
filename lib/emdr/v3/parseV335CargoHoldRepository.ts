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
  "Job_Register",
  "Jobs_Repository",
  "Job_Repository",
  "PMS_Repository",
  "Job_List",
  "PMS_Jobs",
  "Cargo_Hold_Jobs",
] as const;

export const V335_CHHC_MACHINERY_FAMILY =
  "Cargo Hold / Hatch Cover / Container / Bulk Equipment";

const CHHC_JOB_CODE_PATTERN = /^CHHC-\d+$/i;

export function isV335TypewiseChhcJobId(jobId: string): boolean {
  return /^JOBS-CHHC-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /cargo hold|hatch cover|container|bulk equipment|job.?register/i.test(name),
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
    if (cells.includes("Job Code") || (cells.includes("Job Heading") && cells.includes("Section"))) {
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

export function isV335CargoHoldWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = cellStr(row["Job Code"]);
    const machineryGroup = cellStr(row["Machinery Group"] ?? row["Machinery / Equipment Family"]);
    const section = cellStr(row["Section"]);
    return (
      /^V3\.35-/i.test(jobCode) ||
      /^CHHC-\d+$/i.test(jobCode) ||
      /cargo hold|hatch cover|container|bulk equipment/i.test(machineryGroup) ||
      /cargo hold|hatch cover|container ship|bulk carrier|cargo securing|reefer/i.test(section)
    );
  });
}

export function normalizeV335ChhcJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (CHHC_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v335Prefixed = /^V3\.35-CHHC-(\d+)$/i.exec(code);
  if (v335Prefixed) return `JOBS-CHHC-${v335Prefixed[1].padStart(4, "0")}`;
  const v335Plain = /^V3\.35-(\d+)$/i.exec(code);
  if (v335Plain) return `JOBS-CHHC-${v335Plain[1].padStart(4, "0")}`;
  return "";
}

function formatChhcJobCode(sequence: number): string {
  return `JOBS-CHHC-${String(sequence).padStart(4, "0")}`;
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
  return `CHHC-${base}`;
}

function dryDockFlag(row: Record<string, unknown>): boolean {
  const source = cellStr(row["Job Source"]).toLowerCase();
  const section = cellStr(row["Section"]).toLowerCase();
  if (/dry dock|class|survey/i.test(source)) return true;
  if (/dry-dock|class|survey package/i.test(section)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Criticality"] ?? row["Risk / Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  const section = cellStr(row["Section"]).toLowerCase();
  if (/hatch cover|tightness|fire|gas safety|class|survey/i.test(section)) return "High";
  return "Medium";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]).toLowerCase();
  const asset = cellStr(row["Asset / Equipment"]).toLowerCase();
  if (/reefer|cargo electrical|electrical/i.test(`${section} ${asset}`)) return "electrical";
  if (/hatch cover|securing|lashing|container/i.test(`${section} ${asset}`)) return "deck";
  return "deck";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  const component = cellStr(row["Component"]);
  if (heading && asset) return `${asset} — ${heading}`;
  if (heading && component) return `${component} — ${heading}`;
  return heading || asset || component;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const heading = cellStr(row["Job Heading"]);
  if (desc && desc.length >= 12) return desc;
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank / Dept"] ?? row["Responsible Rank"]);
  if (!pic) return "Chief Officer";
  const lower = pic.toLowerCase();
  if (lower.includes("chief officer")) return "Chief Officer";
  if (lower.includes("second engineer") || lower.includes("2nd engineer")) return "Second Engineer";
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("bosun") || lower.includes("deck officer")) return "Chief Officer";
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Officer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]);
  if (section) return section;
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  return asset || V335_CHHC_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  const component = cellStr(row["Component"]);
  const action = cellStr(row["Action Code"] ?? row["Job Action"]);
  const parts = [asset, component, action].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Cargo Hold Equipment";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/hatch cover|tightness|cleat|wheel|chain|hydraulic/i.test(combined)) return "Hatch Cover System";
  if (/container|cell guide|lashing bridge|reefer socket/i.test(combined)) return "Container Equipment";
  if (/bulk carrier|grain|hold washing|ventilation/i.test(combined)) return "Bulk Carrier Equipment";
  if (/lashing|securing|pad eye|d-ring|turnbuckle/i.test(combined)) return "Cargo Securing Gear";
  if (/bilge|drainage|eductor|strum/i.test(combined)) return "Cargo Hold Drainage";
  if (/reefer|electrical|monitoring/i.test(combined)) return "Cargo Electrical";
  if (/fire|gas|smoke|alarm/i.test(combined)) return "Cargo Hold Safety Interface";
  if (/class|survey|utm|ndt/i.test(combined)) return "Survey / Inspection";
  if (/cargo hold|tank top|ladder|manhole|lighting/i.test(combined)) return "Cargo Hold Structure";
  return "Cargo Hold Equipment";
}

function normalizeV335ChhcJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const explicitCode = normalizeV335ChhcJobCode(cellStr(row["Job Code"]));
    sequence += 1;
    let jobId = explicitCode || formatChhcJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatChhcJobCode(sequence);
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
    const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
    const sourceCode = cellStr(row["Job Code"]);
    const workshop = workshopFromRow(row);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: "Deck",
        Machinery: V335_CHHC_MACHINERY_FAMILY,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": "All Types",
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: workshop,
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Officer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": V335_CHHC_MACHINERY_FAMILY,
        "Budget Category": asset || systemName,
        "Cost Code": `DD-CARGO-${systemCode.replace(/^CHHC-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks:
          cellStr(row["Remarks"]) ||
          (sourceCode && !explicitCode ? `Source code: ${sourceCode}` : null) ||
          null,
      },
    ];
  });
}

function synthesizeV335ChhcMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV335ChhcChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per CSS Code, class rules, maker manual and company PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV335ChhcRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V335_CHHC_MACHINERY_FAMILY;
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

function synthesizeV335ChhcEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV335ChhcComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV335ChhcRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V335_CHHC_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV335CargoHoldRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV335CargoHoldWorkbook(workbook)) {
    throw new Error(
      "Not a V3.35 Cargo Hold / Hatch Cover / Container / Bulk Equipment EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.35 Cargo Hold workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV335ChhcJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV335ChhcMeasurements(masterJobs),
    checklistItems: synthesizeV335ChhcChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV335ChhcRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV335ChhcEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV335ChhcComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV335ChhcRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV335CargoHoldRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV335CargoHoldRepositoryBuffer(bytes);
}

export function parseV335CargoHoldRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV335CargoHoldRepositoryFile(path);
  } catch {
    return null;
  }
}
