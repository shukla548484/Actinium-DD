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
  "Jobs_Repository",
  "Job_Repository",
  "PMS_Repository",
  "Job_List",
  "PMS_Jobs",
  "Hull_Structure_Jobs",
] as const;

export const V334_HULL_MACHINERY_FAMILY =
  "Hull Structure / Tanks / Coatings / Dry-Dock Hull Survey";

const HULL_JOB_CODE_PATTERN = /^HULL-\d+$/i;

export function isV334TypewiseHullJobId(jobId: string): boolean {
  return /^JOBS-HULL-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /hull structure|tanks|coatings|dry.?dock|job.?repo/i.test(name),
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

export function isV334HullStructureWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = cellStr(row["Job Code"]);
    const section = cellStr(
      row["Machinery / Equipment Section"] ?? row["Section"] ?? row["Machinery Group"],
    );
    const assetGroup = cellStr(row["Asset Group"]);
    return (
      /^HULL-\d+$/i.test(jobCode) ||
      /^V3\.34-/i.test(jobCode) ||
      /hull structure|tanks|coatings|dry.?dock hull survey/i.test(section) ||
      /hull external shell|ballast tank|coating systems|class survey package/i.test(assetGroup)
    );
  });
}

export function normalizeV334HullJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (HULL_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v334Prefixed = /^V3\.34-HULL-(\d+)$/i.exec(code);
  if (v334Prefixed) return `JOBS-HULL-${v334Prefixed[1].padStart(6, "0")}`;
  const v334Plain = /^V3\.34-(\d+)$/i.exec(code);
  if (v334Plain) return `JOBS-HULL-${v334Plain[1].padStart(6, "0")}`;
  return "";
}

function formatHullJobCode(sequence: number): string {
  return `JOBS-HULL-${String(340000 + sequence).padStart(6, "0")}`;
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
  return `HULL-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "no" || raw === "n" || raw === "pms") return false;
  return raw.startsWith("y") || raw.includes("dry dock") || raw.includes("dry-dock") || raw.includes("class");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const explicit = cellStr(row["Risk / Criticality"] ?? row["Risk Level"]);
  if (/high|critical/i.test(explicit)) return "High";
  if (/low/i.test(explicit)) return "Low";
  if (dryDockFlag(row["Dry-Dock / PMS Category"] ?? row["Dry Dock Scope"] ?? row["Dry Dock / PMS"])) {
    return "High";
  }
  const assetGroup = cellStr(row["Asset Group"]).toLowerCase();
  if (/class survey|hull external|cargo tank|ballast tank|fuel|coating/i.test(assetGroup)) return "High";
  return "Medium";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const assetGroup = cellStr(row["Asset Group"]).toLowerCase();
  const heading = cellStr(row["Job Heading"]).toLowerCase();
  const action = cellStr(row["Job Action"]).toLowerCase();
  if (/coating|paint|surface preparation|blasting|touch.?up/i.test(`${assetGroup} ${heading} ${action}`)) {
    return "paint";
  }
  if (/steel|crop|renew|repair|weld|foundation|bulkhead/i.test(`${assetGroup} ${heading} ${action}`)) {
    return "steel";
  }
  return "hull";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const action = cellStr(row["Job Action"]);
  const asset = cellStr(row["Specific Asset / Component"] ?? row["Asset / Equipment"] ?? row["Asset / Component"]);
  if (action && asset) return `${action}: ${asset}`;
  if (heading && asset) return `${asset} — ${heading}`;
  return heading || asset || action;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const heading = cellStr(row["Job Heading"]);
  if (desc && desc.length >= 12) return desc;
  return heading || desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["Responsible Rank / Dept"] ?? row["PIC"] ?? row["Responsible Rank"]);
  if (!pic) return "Chief Officer";
  const lower = pic.toLowerCase();
  if (lower.includes("chief officer") && lower.includes("chief engineer")) return "Chief Officer";
  if (lower.includes("chief officer") || lower.includes("bosun") || lower.includes("deck officer")) {
    return "Chief Officer";
  }
  if (lower.includes("chief engineer") || lower.includes("2nd engineer") || lower.includes("second engineer")) {
    return "Chief Engineer";
  }
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("shipyard") || lower.includes("superintendent")) return "Chief Officer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const assetGroup = cellStr(row["Asset Group"]);
  if (assetGroup) return assetGroup;
  const section = cellStr(row["Machinery / Equipment Section"] ?? row["Section"]);
  return section || V334_HULL_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const asset = cellStr(row["Specific Asset / Component"] ?? row["Asset / Equipment"] ?? row["Asset / Component"]);
  const action = cellStr(row["Job Action"]);
  const heading = cellStr(row["Job Heading"]);
  if (asset && action) return `${asset} — ${action}`;
  if (asset && heading) return `${asset} — ${heading}`;
  const variant = cellStr(row["Equipment Type / Variant"] ?? row["Type / Variant"] ?? row["Equipment Type"]);
  const parts = [asset, variant].filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} (${parts[1]})`;
  return parts[0] || "Hull Structure Item";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/coating|paint|surface preparation|blasting|touch.?up/i.test(combined)) return "Coating System";
  if (/cargo tank|ballast tank|fuel|fresh water|sewage|grey.?water|domestic tank/i.test(combined)) {
    return "Tank Structure";
  }
  if (/deck structure|foundation|bulkhead/i.test(combined)) return "Deck / Foundation Structure";
  if (/class survey|utm|ndt|thickness/i.test(combined)) return "Survey / Inspection";
  if (/hull external|shell plating|appendage/i.test(combined)) return "Hull Shell Structure";
  if (/opening|closure|manhole|hatch/i.test(combined)) return "Hull Opening / Closure";
  return "Hull Structure";
}

function normalizeV334HullJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    const action = cellStr(row["Job Action"]);
    if (!heading && !action) return [];

    const explicitCode = normalizeV334HullJobCode(cellStr(row["Job Code"]));
    sequence += 1;
    let jobId = explicitCode || formatHullJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatHullJobCode(sequence);
    }
    seenJobIds.add(jobId);

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const dryDock = dryDockFlag(row["Dry-Dock / PMS Category"] ?? row["Dry Dock Scope"] ?? row["Dry Dock / PMS"]);
    const asset = cellStr(row["Specific Asset / Component"] ?? row["Asset / Equipment"]);
    const sourceCode = cellStr(row["Job Code"]);
    const crossRef = cellStr(row["Duplicate Control / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ / Shipyard Scope"] ?? row["RFQ / Cost Code Hint"] ?? row["RFQ Cost Category"]);
    const workshop = workshopFromRow(row);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: "Hull",
        Machinery: V334_HULL_MACHINERY_FAMILY,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": cellStr(row["Applicable Vessel Type"]) || "All Types",
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: workshop,
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Officer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": rfqNote || V334_HULL_MACHINERY_FAMILY,
        "Budget Category": asset || systemName,
        "Cost Code": rfqNote || `DD-HULL-${systemCode.replace(/^HULL-/, "")}`,
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

function synthesizeV334HullMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV334HullChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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
        job.jobDescription || "Complete per class rules, IACS, owner specification and PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV334HullRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V334_HULL_MACHINERY_FAMILY;
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

function synthesizeV334HullEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV334HullComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV334HullRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V334_HULL_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV334HullStructureRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV334HullStructureWorkbook(workbook)) {
    throw new Error(
      "Not a V3.34 Hull Structure / Tanks / Coatings / Dry-Dock Hull Survey EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.34 Hull Structure workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV334HullJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV334HullMeasurements(masterJobs),
    checklistItems: synthesizeV334HullChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV334HullRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV334HullEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV334HullComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV334HullRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV334HullStructureRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV334HullStructureRepositoryBuffer(bytes);
}

export function parseV334HullStructureRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV334HullStructureRepositoryFile(path);
  } catch {
    return null;
  }
}
