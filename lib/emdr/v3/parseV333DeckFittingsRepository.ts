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
  "Job_Repository",
  "PMS_Repository",
  "Job_List",
  "PMS_Jobs",
  "Deck_Fittings_Jobs",
] as const;

export const V333_DFMT_MACHINERY_FAMILY =
  "Deck Fittings / Mooring-Towing / Access & Closing Appliances";

const DFMT_JOB_CODE_PATTERN = /^DFMT-\d+$/i;

export function isV333TypewiseDfmtJobId(jobId: string): boolean {
  return /^JOBS-DFMT-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /deck fittings|mooring|towing|closing appliances|job.?repo/i.test(name),
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

export function isV333DeckFittingsWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = cellStr(row["Job Code"]);
    const machineryFamily = cellStr(
      row["Machinery / Equipment Family"] ?? row["Machinery Group"],
    );
    const section = cellStr(row["Section"]);
    return (
      /^V3\.33-/i.test(jobCode) ||
      /deck fittings|mooring-towing|closing appliances/i.test(machineryFamily) ||
      /mooring|towing fittings|deck fittings|closing appliances|access.*escape/i.test(section)
    );
  });
}

export function normalizeV333DfmtJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (DFMT_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v333Prefixed = /^V3\.33-DFMT-(\d+)$/i.exec(code);
  if (v333Prefixed) return `JOBS-DFMT-${v333Prefixed[1].padStart(4, "0")}`;
  const v333Plain = /^V3\.33-(\d+)$/i.exec(code);
  if (v333Plain) return `JOBS-DFMT-${v333Plain[1].padStart(4, "0")}`;
  return "";
}

function formatDfmtJobCode(sequence: number): string {
  return `JOBS-DFMT-${String(sequence).padStart(4, "0")}`;
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
  return `DFMT-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "no" || raw === "n" || raw === "pms") return false;
  return raw.startsWith("y") || raw.includes("dry dock") || raw.includes("dry-dock");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const dryDock = dryDockFlag(row["Dry Dock Scope"] ?? row["Dry Dock / PMS"] ?? row["Dry-Dock / PMS"]);
  const section = cellStr(row["Section"]).toLowerCase();
  if (dryDock) return "High";
  if (/mooring|towing|watertight|gangway|pilot ladder|emergency towing/i.test(section)) return "High";
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  const component = cellStr(row["Component / Sub-Component"] ?? row["Component"]);
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
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank"]);
  if (!pic) return "Chief Officer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer") || lower.includes("electrician")) {
    return "Electrical Officer";
  }
  if (lower.includes("chief officer")) return "Chief Officer";
  if (lower.includes("third officer") || lower.includes("deck officer")) return "Chief Officer";
  if (lower.includes("bosun")) return "Chief Officer";
  if (lower.includes("safety officer")) return "Safety Officer";
  if (lower.includes("master")) return "Master";
  if (lower.includes("chief engineer") || lower.includes("2nd engineer") || lower.includes("second engineer")) {
    return "Chief Engineer";
  }
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Officer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]);
  if (section) return section;
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  return asset || V333_DFMT_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
  const component = cellStr(row["Component / Sub-Component"] ?? row["Component"]);
  const variant = cellStr(row["Type / Variant"] ?? row["Equipment Type"]);
  const parts = [asset, variant, component].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts.slice(1).join(" — ")})`;
  return parts[0] || "Deck Fitting";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/bollard|bitts|chock|fairlead|roller|mooring|towing|strong point/i.test(combined)) {
    return "Mooring / Towing Fitting";
  }
  if (/hatch|manhole|watertight|weather-tight|door|closing/i.test(combined)) {
    return "Closing Appliance";
  }
  if (/gangway|accommodation ladder|pilot ladder|access/i.test(combined)) {
    return "Access Arrangement";
  }
  if (/vent|air pipe|sounding|scupper|drain/i.test(combined)) {
    return "Deck Opening / Vent";
  }
  if (/mast|railing|grating|pad eye|lashing|securing/i.test(combined)) {
    return "Deck Structural Fitting";
  }
  return "Deck Fitting";
}

function normalizeV333DfmtJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const explicitCode = normalizeV333DfmtJobCode(cellStr(row["Job Code"]));
    sequence += 1;
    let jobId = explicitCode || formatDfmtJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatDfmtJobCode(sequence);
    }
    seenJobIds.add(jobId);

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const dryDock = dryDockFlag(row["Dry Dock Scope"] ?? row["Dry Dock / PMS"]);
    const asset = cellStr(row["Asset / Equipment"] ?? row["Asset / Component"]);
    const sourceCode = cellStr(row["Job Code"]);
    const crossRef = cellStr(row["Duplicate Control / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ / Cost Code Hint"] ?? row["RFQ Cost Category"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: "Deck",
        Machinery: V333_DFMT_MACHINERY_FAMILY,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": (() => {
          const raw = cellStr(row["Applicable Vessel Type"]);
          if (/^all vessel types?$/i.test(raw)) return "All Types";
          if (/^applicable where fitted$/i.test(raw)) return "All Types";
          return raw || "All Types";
        })(),
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: "deck",
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Officer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": rfqNote || V333_DFMT_MACHINERY_FAMILY,
        "Budget Category": asset || systemName,
        "Cost Code": rfqNote || `DD-DECK-${systemCode.replace(/^DFMT-/, "")}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks:
          cellStr(row["Remarks"]) ||
          crossRef ||
          (sourceCode && !explicitCode ? `Source code: ${sourceCode}` : null) ||
          null,
      },
    ];
  });
}

function synthesizeV333DfmtMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV333DfmtChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per maker manual, class rules, SOLAS and PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV333DfmtRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V333_DFMT_MACHINERY_FAMILY;
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

function synthesizeV333DfmtEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV333DfmtComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV333DfmtRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V333_DFMT_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV333DeckFittingsRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV333DeckFittingsWorkbook(workbook)) {
    throw new Error(
      "Not a V3.33 Deck Fittings / Mooring-Towing / Access & Closing Appliances EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.33 Deck Fittings workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV333DfmtJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV333DfmtMeasurements(masterJobs),
    checklistItems: synthesizeV333DfmtChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV333DfmtRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV333DfmtEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV333DfmtComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV333DfmtRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV333DeckFittingsRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV333DeckFittingsRepositoryBuffer(bytes);
}

export function parseV333DeckFittingsRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV333DeckFittingsRepositoryFile(path);
  } catch {
    return null;
  }
}
