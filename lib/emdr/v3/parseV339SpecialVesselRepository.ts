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
  "Special_Vessel_Jobs",
] as const;

export const V339_SVSS_MACHINERY_FAMILY =
  "Special Vessel Systems — RORO / LNG / LPG / Container / AMP";

const SVSS_JOB_CODE_PATTERN = /^SVSS-\d+$/i;

export function isV339TypewiseSvssJobId(jobId: string): boolean {
  return /^JOBS-SVSS-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /special.?vessel|roro|lng|lpg|container|amp|job.?register|^jobs$/i.test(name),
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

function summaryIndicatesV339(workbook: XLSX.WorkBook): boolean {
  const summary = workbook.Sheets.Summary;
  if (!summary) return false;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(summary, { header: 1, defval: "" });
  return matrix.some((row) =>
    Array.isArray(row) &&
    row.some((cell) => /V3\.39/i.test(cellStr(cell)) && /special vessel/i.test(cellStr(cell))),
  );
}

export function isV339SpecialVesselWorkbook(workbook: XLSX.WorkBook): boolean {
  if (summaryIndicatesV339(workbook)) return true;
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = jobCodeSourceFromRow(row);
    const vesselType = cellStr(row["Vessel Type"]);
    const systemGroup = cellStr(row["System Group"] ?? row["Phase / Section"] ?? row["Section"]);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    const version = cellStr(row["Repository Version"]);
    return (
      /^V3\.39/i.test(version) ||
      /^V3\.39-\d+$/i.test(jobCode) ||
      /^SVSS-\d+$/i.test(jobCode) ||
      /ro-?ro|lng|lpg|gas carrier|container vessel|cold ironing|\bamp\b/i.test(vesselType) ||
      /ro-?ro ramp|cargo cooling|bog|reliquefaction|cargo containment|cold ironing|container cargo|automatic cargo discharge/i.test(
        `${systemGroup} ${equipment}`,
      )
    );
  });
}

export function normalizeV339SvssJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (SVSS_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v339Prefixed = /^V3\.39-SVSS-(\d+)$/i.exec(code);
  if (v339Prefixed) return `JOBS-SVSS-${v339Prefixed[1].padStart(4, "0")}`;
  const v339Plain = /^V3\.39-(\d+)$/i.exec(code);
  if (v339Plain) return `JOBS-SVSS-${v339Plain[1].padStart(4, "0")}`;
  return "";
}

function formatSvssJobCode(sequence: number): string {
  return `JOBS-SVSS-${String(sequence).padStart(4, "0")}`;
}

function jobCodeSourceFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Job Code"]);
  if (explicit) return explicit;
  const remarks = cellStr(row["Remarks"]);
  if (SVSS_JOB_CODE_PATTERN.test(remarks)) return remarks;
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
  return `SVSS-${base}`;
}

function dryDockFlag(row: Record<string, unknown>): boolean {
  const scope = cellStr(
    row["Dry-Dock Scope"] ??
      row["Dry-Dock / Shipyard Scope"] ??
      row["Dry Dock Scope"] ??
      row["Dry Dock / PMS"] ??
      row["Dry-Dock / PMS"],
  );
  if (/^yes$/i.test(scope)) return true;
  if (/included|dry.?dock|shipyard|class|survey|statutory|pressure.?test/i.test(scope)) return true;
  const phase = cellStr(row["Phase"] ?? row["Phase / Section"]);
  if (/dry dock/i.test(phase)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Risk / Criticality"] ?? row["Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  const remarks = cellStr(row["Remarks"]).toLowerCase();
  if (/critical safety|safety item/i.test(remarks)) return "High";
  const systemGroup = cellStr(row["System Group"]).toLowerCase();
  if (/cargo safety|containment|gas detection|reliquefaction/i.test(systemGroup)) return "High";
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
  if (desc && desc.length >= 12) return desc;
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank / Dept"] ?? row["Responsible Rank"]);
  if (!pic) return "Chief Engineer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer")) return "Electrical Officer";
  if (lower.includes("cargo officer")) return "Chief Officer";
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("second engineer") || lower.includes("2nd engineer")) return "Second Engineer";
  if (lower.includes("class surveyor")) return "Chief Engineer";
  if (lower.includes("maker service engineer") || lower.includes("service engineer")) {
    return "Fourth Engineer";
  }
  if (lower.includes("safety officer")) return "Chief Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank"]).toLowerCase();
  const vesselType = cellStr(row["Vessel Type"]).toLowerCase();
  const systemGroup = cellStr(row["System Group"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${vesselType} ${systemGroup} ${equipment}`;
  if (/\beto\b/.test(pic) || pic.includes("electrical officer")) return "Electrical";
  if (pic.includes("cargo officer")) return "Deck";
  if (pic.includes("chief officer") || pic.includes("bosun") || /ro-?ro|container|vehicle deck/i.test(combined)) {
    return "Deck";
  }
  if (/cold ironing|\bamp\b|shore connection|high voltage/i.test(combined)) return "Electrical";
  if (/lng|lpg|gas carrier|cargo cooling|bog|reliquefaction|cargo containment|cargo manifold/i.test(combined)) {
    return "Engine";
  }
  if (pic.includes("chief engineer") || pic.includes("engineer")) return "Engine";
  return "Engine";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const systemGroup = cellStr(row["System Group"]);
  if (systemGroup) return systemGroup;
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  if (equipment) return equipment;
  const phase = cellStr(row["Phase"] ?? row["Phase / Section"] ?? row["Section"]);
  if (phase) return phase;
  return V339_SVSS_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
  const component = cellStr(row["Component"]);
  const equipmentType = cellStr(row["Equipment Type / Variant"] ?? row["Equipment Type"]);
  const action = cellStr(row["Job Action"] ?? row["Action Code"] ?? row["Job Type"]);
  const parts = [equipment, component, equipmentType, action].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Special Vessel Equipment";
}

function vesselTypesFromRow(row: Record<string, unknown>): string {
  const vesselType = cellStr(row["Vessel Type"]);
  if (!vesselType || /all vessel types/i.test(vesselType)) return "All Types";
  return vesselType;
}

function workshopFromRow(row: Record<string, unknown>): string {
  const systemGroup = cellStr(row["System Group"]).toLowerCase();
  const equipment = cellStr(row["Machinery / Equipment"]).toLowerCase();
  const combined = `${systemGroup} ${equipment}`;
  if (/cold ironing|\bamp\b|shore connection|high voltage|electrical/i.test(combined)) {
    return "electrical workshop";
  }
  if (/ro-?ro|container|vehicle deck|ramp|car deck/i.test(combined)) return "deck workshop";
  if (/hydraulic|cylinder|ram/i.test(combined)) return "machinery workshop";
  if (/lng|lpg|cargo compressor|reliquefaction|containment/i.test(combined)) return "machinery workshop";
  return "machinery workshop";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/ro-?ro ramp|stern ramp|side ramp|internal ramp/i.test(combined)) return "Ro-Ro Ramp System";
  if (/car deck|hoistable deck/i.test(combined)) return "Hoistable Car Deck";
  if (/vehicle deck|gas detection/i.test(combined)) return "Vehicle Deck Safety System";
  if (/cargo cooling|bog|reliquefaction/i.test(combined)) return "Gas Cargo Cooling / BOG";
  if (/cargo discharge|auto.*unload|stripping/i.test(combined)) return "Cargo Discharge System";
  if (/cargo containment|tank insulation/i.test(combined)) return "Cargo Containment";
  if (/cold ironing|\bamp\b|shore connection/i.test(combined)) return "AMP / Cold Ironing";
  if (/container|lashing|twistlock|reefer/i.test(combined)) return "Container Cargo System";
  if (/hydraulic.*ram|cylinder/i.test(combined)) return "Hydraulic Rams / Cylinders";
  return "Special Vessel Equipment";
}

function normalizeV339SvssJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const sourceCode = jobCodeSourceFromRow(row);
    const explicitCode = normalizeV339SvssJobCode(sourceCode);
    sequence += 1;
    let jobId = explicitCode || formatSvssJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatSvssJobCode(sequence);
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
    const rfqNote = cellStr(row["RFQ Group"] ?? row["RFQ Scope"] ?? row["RFQ / Cost Mapping"]);
    const remarksText = cellStr(row["Remarks"]);
    const remarksIsCode = SVSS_JOB_CODE_PATTERN.test(remarksText);
    const equipment = cellStr(row["Machinery / Equipment"] ?? row["Equipment / Asset"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V339_SVSS_MACHINERY_FAMILY,
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
        "RFQ Category": rfqNote || V339_SVSS_MACHINERY_FAMILY,
        "Budget Category": equipment || systemName,
        "Cost Code": `DD-SVSS-${systemCode.replace(/^SVSS-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": /maker/i.test(cellStr(row["Verifying Authority"])) ? "Y" : "N",
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

function synthesizeV339SvssMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV339SvssChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV339SvssRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V339_SVSS_MACHINERY_FAMILY;
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

function synthesizeV339SvssEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV339SvssComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV339SvssRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V339_SVSS_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV339SpecialVesselRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV339SpecialVesselWorkbook(workbook)) {
    throw new Error(
      "Not a V3.39 Special Vessel Systems (RORO / LNG / LPG / Container / AMP) EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.39 Special Vessel Systems workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV339SvssJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV339SvssMeasurements(masterJobs),
    checklistItems: synthesizeV339SvssChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV339SvssRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV339SvssEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV339SvssComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV339SvssRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV339SpecialVesselRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV339SpecialVesselRepositoryBuffer(bytes);
}

export function parseV339SpecialVesselRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV339SpecialVesselRepositoryFile(path);
  } catch {
    return null;
  }
}
