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
  "Gap_Closure_Jobs",
  "Emergency_Damage_Control_Jobs",
] as const;

export const V341_EDMC_MACHINERY_FAMILY =
  "Emergency / Damage Control / Misc Critical Systems — Final Gap Closure";

const EDMC_JOB_CODE_PATTERN = /^EDMC-\d+$/i;
const V341_SOURCE_JOB_CODE_PATTERN = /^V3\.41-J\d+$/i;

export function isV341TypewiseEdmcJobId(jobId: string): boolean {
  return /^JOBS-EDMC-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /gap.?closure|emergency|damage.?control|misc.?critical|job.?register|^jobs$/i.test(name),
    ) ?? null
  );
}

function normalizeUnderscoreRow(row: Record<string, unknown>): Record<string, unknown> {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && cellStr(value)) return value;
    }
    return "";
  };

  return {
    "Job Code": get("Job Code", "Job_Code"),
    Phase: get("Phase", "Phase / Section"),
    Section: get("Section", "System_Group", "Phase / Section", "System Group"),
    "Machinery / Equipment": get("Machinery / Equipment", "Machinery_Equipment", "Equipment / Asset"),
    Component: get("Component"),
    "Job Heading": get("Job Heading", "Job_Heading"),
    "Job Description": get("Job Description", "Job_Description", "Job Description / Scope"),
    "Job Type": get("Job Type", "Job_Action", "Job Action", "Action Code"),
    "Dry Dock Phase": get(
      "Dry Dock Phase",
      "Dry_Dock_RFQ_Scope",
      "Dry-Dock Scope",
      "Dry-Dock / Shipyard Scope",
      "Dry Dock Scope",
    ),
    Priority: get("Priority", "Risk / Criticality", "Criticality"),
    PIC: get("PIC", "Responsibility", "Responsible Rank / Dept", "Responsible_Rank", "Responsible Rank"),
    "Verifying Authority": get("Verifying Authority", "Verifying_Authority"),
    "Ship Type Applicability": get(
      "Ship Type Applicability",
      "Applicable_Vessel_Type",
      "Vessel Type",
      "Applicable Vessel Type",
    ),
    "Cross Reference Module": get(
      "Cross Reference Module",
      "Reference_Module",
      "Duplicate Control / Cross Reference",
      "Duplicate_Control",
    ),
    "RFQ Group": get("RFQ Group", "RFQ_Group", "RFQ Scope", "RFQ / Cost Mapping"),
    Remarks: get("Remarks"),
    "Repository Version": get("Repository Version"),
  };
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
    if (cells.includes("Job_Code") && cells.includes("Job_Heading")) {
      headerIdx = i;
      break;
    }
    if (cells.includes("Repository Version") && cells.includes("Job Heading")) {
      headerIdx = i;
      break;
    }
    if (
      cells.includes("Job Code") ||
      cells.includes("Job_Code") ||
      (cells.includes("Job Heading") &&
        (cells.includes("Phase / Section") || cells.includes("Phase") || cells.includes("Section"))) ||
      (cells.includes("Job_Heading") && (cells.includes("System_Group") || cells.includes("Phase")))
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
    if (hasContent) rows.push(normalizeUnderscoreRow(record));
  }
  return rows;
}

function coverageCheckIndicatesV341(workbook: XLSX.WorkBook): boolean {
  const sheet = workbook.Sheets.Coverage_Check;
  if (!sheet) return false;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return matrix.some(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => /V3\.41|final gap closure|damage control equipment/i.test(cellStr(cell))),
  );
}

function assetRegisterIndicatesV341(workbook: XLSX.WorkBook): boolean {
  const sheet = workbook.Sheets.Asset_Register;
  if (!sheet) return false;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return matrix.some(
    (row) =>
      Array.isArray(row) &&
      row.some((cell) => /V3\.41-AS-|V3\.41 final gap closure/i.test(cellStr(cell))),
  );
}

export function isV341GapClosureWorkbook(workbook: XLSX.WorkBook): boolean {
  if (coverageCheckIndicatesV341(workbook) || assetRegisterIndicatesV341(workbook)) return true;
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = jobCodeSourceFromRow(row);
    const section = cellStr(row["Section"] ?? row["Phase / Section"] ?? row["System Group"]);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    const version = cellStr(row["Repository Version"]);
    return (
      /^V3\.41/i.test(version) ||
      /^V3\.41-/i.test(jobCode) ||
      /^EDMC-\d+$/i.test(jobCode) ||
      /emergency response|damage control|final gap closure|watertight integrity|fire boundary/i.test(
        `${section} ${equipment}`,
      )
    );
  });
}

export function normalizeV341EdmcJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (EDMC_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v341Prefixed = /^V3\.41-EDMC-(\d+)$/i.exec(code);
  if (v341Prefixed) return `JOBS-EDMC-${v341Prefixed[1].padStart(4, "0")}`;
  const v341Section = /^V3\.41-J(\d+)$/i.exec(code);
  if (v341Section) return `JOBS-EDMC-${v341Section[1].padStart(4, "0")}`;
  const v341Plain = /^V3\.41-(\d+)$/i.exec(code);
  if (v341Plain) return `JOBS-EDMC-${v341Plain[1].padStart(4, "0")}`;
  return "";
}

function formatEdmcJobCode(sequence: number): string {
  return `JOBS-EDMC-${String(sequence).padStart(4, "0")}`;
}

function jobCodeSourceFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Job Code"]);
  if (explicit) return explicit;
  const remarks = cellStr(row["Remarks"]);
  if (EDMC_JOB_CODE_PATTERN.test(remarks) || V341_SOURCE_JOB_CODE_PATTERN.test(remarks)) return remarks;
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
  return `EDMC-${base}`;
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
  if (/docking|survey|repair|verification|dry.?dock|isolation|blanking|commissioning/i.test(phase)) {
    return true;
  }
  const section = cellStr(row["Section"]).toLowerCase();
  if (/dry dock|isolation|commissioning|watertight|fire boundary/i.test(section)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Priority"] ?? row["Risk / Criticality"] ?? row["Criticality"] ?? row["Risk Level"]);
  if (/critical|high/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  const section = cellStr(row["Section"]).toLowerCase();
  if (/emergency|damage control|fire boundary|watertight/i.test(section)) return "High";
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
  const crossRef = cellStr(row["Cross Reference Module"]);
  if (desc && desc.length >= 12) {
    return crossRef ? `${desc} Cross-ref: ${crossRef}` : desc;
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
  if (lower.includes("safety officer")) return "Safety Officer";
  if (lower.includes("technical superintendent") || lower.includes("superintendent")) {
    return "Chief Engineer";
  }
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("chief engineer") || lower.includes("second engineer") || lower.includes("third engineer")) {
    return "Chief Engineer";
  }
  if (lower.includes("electrical officer")) return "Electrical Officer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsibility"]).toLowerCase();
  const section = cellStr(row["Section"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${section} ${equipment}`;
  if (/\beto\b/.test(pic) || pic.includes("electrical officer") || /electrical emergency|safety\/electrical/i.test(combined)) {
    return "Electrical";
  }
  if (/deck emergency|deck safety|pilot|embarkation|life saving|lifting support|access equipment/i.test(combined)) {
    return "Deck";
  }
  if (pic.includes("chief officer") || pic.includes("bosun") || pic.includes("safety officer")) return "Deck";
  if (/damage control|emergency response|bunkering|cargo support|hull\/tanks/i.test(combined)) return "Engine";
  if (pic.includes("chief engineer") || pic.includes("engineer")) return "Engine";
  return "Safety";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"] ?? row["Phase / Section"] ?? row["System Group"]);
  if (section) return section;
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  if (equipment) return equipment;
  return V341_EDMC_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  const component = cellStr(row["Component"]);
  const jobType = cellStr(row["Job Type"] ?? row["Job Action"] ?? row["Action Code"]);
  const parts = [equipment, component, jobType].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Emergency / Damage Control Item";
}

function vesselTypesFromRow(row: Record<string, unknown>): string {
  const vesselType = cellStr(row["Ship Type Applicability"] ?? row["Vessel Type"]);
  if (
    !vesselType ||
    /^all$/i.test(vesselType) ||
    /all vessels|all vessel types|all \/ applicable|all applicable/i.test(vesselType)
  ) {
    return "All Types";
  }
  if (/tankers\/bulk\/container/i.test(vesselType)) return "Tanker; Bulk Carrier; Container Ship";
  if (/tankers\/all/i.test(vesselType)) return "Tanker";
  if (/tankers\/gas/i.test(vesselType)) return "LNG / LPG / Gas Carrier";
  if (/^tankers$/i.test(vesselType)) return "Tanker";
  if (vesselType.includes("/")) {
    const mapped = vesselType
      .split("/")
      .map((part) => part.trim().toLowerCase())
      .flatMap((part) => {
        if (!part || part === "all") return [];
        if (part.includes("tanker")) return ["Tanker"];
        if (part.includes("bulk")) return ["Bulk Carrier"];
        if (part.includes("container")) return ["Container Ship"];
        if (part.includes("gas")) return ["LNG / LPG / Gas Carrier"];
        return [];
      });
    if (mapped.length > 0) return [...new Set(mapped)].join("; ");
  }
  return vesselType;
}

function workshopFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${section} ${equipment}`;
  if (/electrical emergency|safety\/electrical|emergency lighting|emergency stop/i.test(combined)) {
    return "electrical workshop";
  }
  if (/deck emergency|deck safety|pilot|embarkation|life saving|lifting support/i.test(combined)) {
    return "deck workshop";
  }
  if (/dry dock|isolation|repair support/i.test(combined)) return "shipyard office";
  if (/damage control|emergency response|bunkering|cargo support/i.test(combined)) return "machinery workshop";
  return "safety service";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/emergency response|emergency generator|emergency accessories/i.test(combined)) return "Emergency Response Control";
  if (/damage control|collision mat|dewatering|flooding/i.test(combined)) return "Damage Control Equipment";
  if (/watertight|fire boundary|hull\/fire/i.test(combined)) return "Boundary Integrity Control";
  if (/emergency control|enclosed space|emergency stop/i.test(combined)) return "Emergency Control System";
  if (/medical|rescue|breathing air/i.test(combined)) return "Rescue / Medical Support";
  if (/bunkering|pollution|spill/i.test(combined)) return "Bunker Safety / Pollution Control";
  if (/dry dock|isolation|blanking|commissioning/i.test(combined)) return "Dry-Dock Enabling / Commissioning";
  if (/spares|tools/i.test(combined)) return "Critical Spares / Tools";
  return "Misc Critical Systems Item";
}

function normalizeV341EdmcJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const sourceCode = jobCodeSourceFromRow(row);
    const explicitCode = normalizeV341EdmcJobCode(sourceCode);
    sequence += 1;
    let jobId = explicitCode || formatEdmcJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatEdmcJobCode(sequence);
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
    const remarksIsCode =
      EDMC_JOB_CODE_PATTERN.test(remarksText) || V341_SOURCE_JOB_CODE_PATTERN.test(remarksText);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V341_EDMC_MACHINERY_FAMILY,
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
        "RFQ Category": rfqNote || V341_EDMC_MACHINERY_FAMILY,
        "Budget Category": equipment || systemName,
        "Cost Code": `DD-EDMC-${systemCode.replace(/^EDMC-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": /maker|service engineer|oem/i.test(cellStr(row["Verifying Authority"])) ? "Y" : "N",
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

function synthesizeV341EdmcMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      measurementId: `${ids.measurementSetId}-01`,
      measurementSetId: ids.measurementSetId,
      templateId: job.templateId,
      measurementName: "Emergency readiness / completion record",
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

function synthesizeV341EdmcChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per SOLAS/MARPOL, company SMS and emergency response procedures",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV341EdmcRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V341_EDMC_MACHINERY_FAMILY;
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

function synthesizeV341EdmcEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV341EdmcComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV341EdmcRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V341_EDMC_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV341GapClosureRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV341GapClosureWorkbook(workbook)) {
    throw new Error(
      "Not a V3.41 Emergency / Damage Control / Misc Critical Systems — Final Gap Closure EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.41 Gap Closure workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV341EdmcJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV341EdmcMeasurements(masterJobs),
    checklistItems: synthesizeV341EdmcChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV341EdmcRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV341EdmcEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV341EdmcComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV341EdmcRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV341GapClosureRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV341GapClosureRepositoryBuffer(bytes);
}

export function parseV341GapClosureRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV341GapClosureRepositoryFile(path);
  } catch {
    return null;
  }
}
