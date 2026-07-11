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
  "Domestic_Water_Jobs",
] as const;

export const V336_DWSS_MACHINERY_FAMILY =
  "Domestic Fresh Water / Potable Water / Sanitary / Drainage Service Systems";

const DWSS_JOB_CODE_PATTERN = /^DWSS-\d+$/i;

export function isV336TypewiseDwssJobId(jobId: string): boolean {
  return /^JOBS-DWSS-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /domestic.*water|sanitary|drainage|potable|job.?register|^jobs$/i.test(name),
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
    if (cells.includes("Job Code") || (cells.includes("Job Heading") && cells.includes("Phase / Section"))) {
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

export function isV336DomesticWaterWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = jobCodeSourceFromRow(row);
    const machinery = cellStr(row["Machinery / Equipment"] ?? row["Machinery Group"]);
    const section = cellStr(row["Phase / Section"] ?? row["Section"]);
    const version = cellStr(row["Repository Version"]);
    return (
      /^V3\.36/i.test(version) ||
      /^DWSS-\d+$/i.test(jobCode) ||
      /domestic fresh water|potable water|sanitary|drainage service/i.test(section) ||
      /potable fresh water|sanitary vacuum|grey water|black water|domestic sea water/i.test(machinery)
    );
  });
}

export function normalizeV336DwssJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (DWSS_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v336Prefixed = /^V3\.36-DWSS-(\d+)$/i.exec(code);
  if (v336Prefixed) return `JOBS-DWSS-${v336Prefixed[1].padStart(4, "0")}`;
  const v336Plain = /^V3\.36-(\d+)$/i.exec(code);
  if (v336Plain) return `JOBS-DWSS-${v336Plain[1].padStart(4, "0")}`;
  return "";
}

function formatDwssJobCode(sequence: number): string {
  return `JOBS-DWSS-${String(sequence).padStart(4, "0")}`;
}

function jobCodeSourceFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Job Code"]);
  if (explicit) return explicit;
  const remarks = cellStr(row["Remarks"]);
  if (DWSS_JOB_CODE_PATTERN.test(remarks)) return remarks;
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
  return `DWSS-${base}`;
}

function dryDockFlag(row: Record<string, unknown>): boolean {
  const scope = cellStr(row["Dry-Dock / Shipyard Scope"] ?? row["Dry Dock / PMS"] ?? row["Dry-Dock / PMS"]);
  if (/included|dry.?dock|shipyard|pressure.?test|opened/i.test(scope)) return true;
  return false;
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Criticality"] ?? row["Risk / Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row)) return "High";
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const component = cellStr(row["Component / Sub-System"] ?? row["Component"]);
  const equipment = cellStr(row["Machinery / Equipment"] ?? row["Asset / Equipment"]);
  if (heading && component) return `${component} — ${heading}`;
  if (heading && equipment) return `${equipment} — ${heading}`;
  return heading || component || equipment;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description / Scope"] ?? row["Job Description"]);
  const heading = cellStr(row["Job Heading"]);
  if (desc && desc.length >= 12) return desc;
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank / Dept"] ?? row["Responsible Rank"]);
  if (!pic) return "Fourth Engineer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer")) return "Electrical Officer";
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("second engineer") || lower.includes("2nd engineer")) return "Second Engineer";
  if (lower.includes("motorman") || lower.includes("oiler") || lower.includes("fitter")) return "Fourth Engineer";
  if (lower.includes("chief cook") || lower.includes("ship staff")) return "Second Engineer";
  if (lower.includes("safety officer")) return "Chief Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Engineer";
  if (lower.includes("service engineer")) return "Fourth Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank"]).toLowerCase();
  const system = cellStr(row["Machinery / Equipment"] ?? row["Phase / Section"]).toLowerCase();
  if (/\beto\b/.test(pic) || pic.includes("electrical officer")) return "Electrical";
  if (pic.includes("bosun") || pic.includes("chief officer") || /deck wash|service water/i.test(system)) {
    return "Deck";
  }
  if (pic.includes("chief cook") || pic.includes("ship staff") || /accommodation drain/i.test(system)) {
    return "Accommodation";
  }
  if (pic.includes("safety officer")) return "Safety";
  return "Engine";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const machinery = cellStr(row["Machinery / Equipment"]);
  if (machinery) return machinery;
  const section = cellStr(row["Phase / Section"] ?? row["Section"]);
  if (section) return section;
  return V336_DWSS_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const component = cellStr(row["Component / Sub-System"] ?? row["Component"]);
  const equipmentType = cellStr(row["Equipment Type / Variant"]);
  if (component && equipmentType && !component.includes(equipmentType)) {
    return `${component} (${equipmentType})`;
  }
  return component || equipmentType || "Domestic Water / Sanitary Equipment";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["Machinery / Equipment"] ?? row["Phase / Section"]).toLowerCase();
  const component = cellStr(row["Component / Sub-System"]).toLowerCase();
  const combined = `${system} ${component}`;
  if (/uv|chlorination|electrical|alarm|instrument|ias/i.test(combined)) return "electrical workshop";
  if (/deck wash|service water|hydrant/i.test(combined)) return "deck workshop";
  if (/vacuum toilet|sanitary|drain|sewage|grey water|black water/i.test(combined)) {
    return "hull workshop";
  }
  if (/hot water|calorifier|steam/i.test(combined)) return "engine room / hvac ventilation";
  return "machinery workshop";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/potable|fresh water|hydrophore|bunkering/i.test(combined)) return "Potable Water System";
  if (/uv|chlorination|water quality|disinfection/i.test(combined)) return "Water Quality Control";
  if (/hot water|calorifier/i.test(combined)) return "Hot Water System";
  if (/vacuum toilet|sanitary vacuum/i.test(combined)) return "Vacuum Sanitary System";
  if (/gravity|drain|trap/i.test(combined)) return "Sanitary Drainage";
  if (/grey water/i.test(combined)) return "Grey Water Collection";
  if (/black water|sewage/i.test(combined)) return "Sewage Collection";
  if (/deck wash|service water/i.test(combined)) return "Service Water";
  if (/medical|hospital/i.test(combined)) return "Medical Water Points";
  if (/sea water|domestic sea/i.test(combined)) return "Domestic Sea Water";
  return "Domestic Water / Sanitary Equipment";
}

function normalizeV336DwssJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const sourceCode = jobCodeSourceFromRow(row);
    const explicitCode = normalizeV336DwssJobCode(sourceCode);
    sequence += 1;
    let jobId = explicitCode || formatDwssJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatDwssJobCode(sequence);
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
    const crossRef = cellStr(row["Duplicate / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ / Cost Mapping"]);
    const remarksText = cellStr(row["Remarks"]);
    const remarksIsCode = DWSS_JOB_CODE_PATTERN.test(remarksText);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V336_DWSS_MACHINERY_FAMILY,
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
        "RFQ Category": rfqNote || V336_DWSS_MACHINERY_FAMILY,
        "Budget Category": systemName,
        "Cost Code": `DD-DWSS-${systemCode.replace(/^DWSS-/, "")}`,
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

function synthesizeV336DwssMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV336DwssChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV336DwssRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V336_DWSS_MACHINERY_FAMILY;
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

function synthesizeV336DwssEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV336DwssComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV336DwssRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V336_DWSS_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV336DomesticWaterRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV336DomesticWaterWorkbook(workbook)) {
    throw new Error(
      "Not a V3.36 Domestic Fresh Water / Potable Water / Sanitary / Drainage Service Systems EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.36 Domestic Water workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV336DwssJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV336DwssMeasurements(masterJobs),
    checklistItems: synthesizeV336DwssChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV336DwssRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV336DwssEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV336DwssComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV336DwssRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV336DomesticWaterRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV336DomesticWaterRepositoryBuffer(bytes);
}

export function parseV336DomesticWaterRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV336DomesticWaterRepositoryFile(path);
  } catch {
    return null;
  }
}
