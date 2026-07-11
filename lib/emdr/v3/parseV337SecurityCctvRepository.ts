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
  "Security_CCTV_Jobs",
] as const;

export const V337_SCACS_MACHINERY_FAMILY =
  "Security / CCTV / Access Control / IT Network & Cyber Systems";

const SCACS_JOB_CODE_PATTERN = /^SCACS-\d+$/i;

export function isV337TypewiseScacsJobId(jobId: string): boolean {
  return /^JOBS-SCACS-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /security|cctv|access control|cyber|it network|job.?register|^jobs$/i.test(name),
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
      (cells.includes("Job Heading") && (cells.includes("Phase / Section") || cells.includes("Section")))
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

export function isV337SecurityCctvWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = jobCodeSourceFromRow(row);
    const section = cellStr(row["Section"] ?? row["Phase / Section"]);
    const assetGroup = cellStr(row["Asset Group"] ?? row["Sub Section"]);
    const equipment = cellStr(row["Equipment / Asset"] ?? row["Machinery / Equipment"]);
    const version = cellStr(row["Repository Version"]);
    return (
      /^V3\.37/i.test(version) ||
      /^SCACS-\d+$/i.test(jobCode) ||
      /security.*cctv|access control|it network|cyber/i.test(section) ||
      /cctv|access control|ssas|ship security|cyber|network infrastructure|anti-piracy/i.test(
        `${assetGroup} ${equipment}`,
      )
    );
  });
}

export function normalizeV337ScacsJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (SCACS_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v337Prefixed = /^V3\.37-SCACS-(\d+)$/i.exec(code);
  if (v337Prefixed) return `JOBS-SCACS-${v337Prefixed[1].padStart(4, "0")}`;
  const v337Plain = /^V3\.37-(\d+)$/i.exec(code);
  if (v337Plain) return `JOBS-SCACS-${v337Plain[1].padStart(4, "0")}`;
  return "";
}

function formatScacsJobCode(sequence: number): string {
  return `JOBS-SCACS-${String(sequence).padStart(4, "0")}`;
}

function jobCodeSourceFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Job Code"]);
  if (explicit) return explicit;
  const remarks = cellStr(row["Remarks"]);
  if (SCACS_JOB_CODE_PATTERN.test(remarks)) return remarks;
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
  return `SCACS-${base}`;
}

function dryDockFlag(row: Record<string, unknown>): boolean {
  const scope = cellStr(
    row["Dry Dock Scope"] ??
      row["Dry-Dock / Shipyard Scope"] ??
      row["Dry Dock / PMS"] ??
      row["Dry-Dock / PMS"],
  );
  if (/included|dry.?dock|shipyard|class|survey|statutory/i.test(scope)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Risk / Criticality"] ?? row["Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  const assetGroup = cellStr(row["Asset Group"] ?? row["Sub Section"]).toLowerCase();
  if (/ssas|cyber|anti-piracy|ship security/i.test(assetGroup)) return "High";
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const equipment = cellStr(row["Equipment / Asset"] ?? row["Machinery / Equipment"]);
  const component = cellStr(row["Component"]);
  if (heading && equipment) return `${equipment} — ${heading}`;
  if (heading && component) return `${component} — ${heading}`;
  return heading || equipment || component;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const heading = cellStr(row["Job Heading"]);
  if (desc && desc.length >= 12) return desc;
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank / Dept"] ?? row["Responsible Rank"]);
  if (!pic) return "Electrical Officer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer")) return "Electrical Officer";
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("second engineer") || lower.includes("2nd engineer")) return "Second Engineer";
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("safety officer")) return "Chief Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const assetGroup = cellStr(row["Asset Group"] ?? row["Sub Section"]);
  if (assetGroup) return assetGroup;
  const section = cellStr(row["Section"] ?? row["Phase / Section"]);
  if (section) return section;
  return V337_SCACS_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const equipment = cellStr(row["Equipment / Asset"] ?? row["Machinery / Equipment"]);
  const component = cellStr(row["Component"]);
  const equipmentType = cellStr(row["Equipment Type / Variant"] ?? row["Equipment Type"]);
  const action = cellStr(row["Job Action"] ?? row["Action Code"]);
  const parts = [equipment, component, equipmentType, action].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Security / CCTV / IT Equipment";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const assetGroup = cellStr(row["Asset Group"] ?? row["Sub Section"]).toLowerCase();
  const equipment = cellStr(row["Equipment / Asset"]).toLowerCase();
  const combined = `${assetGroup} ${equipment}`;
  if (/cctv|camera|nvr|access control|card reader|door controller/i.test(combined)) {
    return "electrical workshop";
  }
  if (/network|switch|server|firewall|router|nas|cyber|it infrastructure/i.test(combined)) {
    return "electrical workshop";
  }
  if (/ssas|anti-piracy|security alert|watchman/i.test(combined)) return "electrical workshop";
  if (/pa\/ga|public address|alarm interface/i.test(combined)) return "electrical workshop";
  return "electrical workshop";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/cctv|camera|nvr|video/i.test(combined)) return "CCTV System";
  if (/access control|card reader|keypad|door controller/i.test(combined)) return "Access Control System";
  if (/ssas|ship security alert/i.test(combined)) return "Ship Security Alert System";
  if (/pa\/ga|public address|general alarm/i.test(combined)) return "PA/GA Interface";
  if (/network|switch|server|lan|router|firewall|nas/i.test(combined)) return "IT Network Infrastructure";
  if (/cyber|ot network|security patch/i.test(combined)) return "Cyber Security / OT Network";
  if (/anti-piracy|citadel|barrier/i.test(combined)) return "Anti-Piracy / Ship Security";
  if (/crew welfare|communication it|wifi|internet/i.test(combined)) return "Crew Welfare / Communication IT";
  return "Security / CCTV / IT Equipment";
}

function normalizeV337ScacsJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const sourceCode = jobCodeSourceFromRow(row);
    const explicitCode = normalizeV337ScacsJobCode(sourceCode);
    sequence += 1;
    let jobId = explicitCode || formatScacsJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatScacsJobCode(sequence);
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
    const crossRef = cellStr(row["Duplicate Control / Cross Reference"] ?? row["Duplicate / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ Scope"] ?? row["RFQ / Cost Mapping"]);
    const remarksText = cellStr(row["Remarks"]);
    const remarksIsCode = SCACS_JOB_CODE_PATTERN.test(remarksText);
    const equipment = cellStr(row["Equipment / Asset"] ?? row["Machinery / Equipment"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: "Electrical",
        Machinery: V337_SCACS_MACHINERY_FAMILY,
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
        "RFQ Category": rfqNote || V337_SCACS_MACHINERY_FAMILY,
        "Budget Category": equipment || systemName,
        "Cost Code": `DD-SCACS-${systemCode.replace(/^SCACS-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
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

function synthesizeV337ScacsMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV337ScacsChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per maker manual, class rules and company PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV337ScacsRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V337_SCACS_MACHINERY_FAMILY;
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

function synthesizeV337ScacsEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV337ScacsComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV337ScacsRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V337_SCACS_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV337SecurityCctvRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV337SecurityCctvWorkbook(workbook)) {
    throw new Error(
      "Not a V3.37 Security / CCTV / Access Control / IT Network & Cyber Systems EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.37 Security / CCTV workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV337ScacsJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV337ScacsMeasurements(masterJobs),
    checklistItems: synthesizeV337ScacsChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV337ScacsRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV337ScacsEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV337ScacsComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV337ScacsRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV337SecurityCctvRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV337SecurityCctvRepositoryBuffer(bytes);
}

export function parseV337SecurityCctvRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV337SecurityCctvRepositoryFile(path);
  } catch {
    return null;
  }
}
