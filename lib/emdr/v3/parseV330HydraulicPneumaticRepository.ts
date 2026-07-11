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
  "PMS_Repository",
  "Hyd_Pneu_Jobs",
  "Job_List",
  "Job_Repository",
  "PMS_Jobs",
] as const;

export const V330_HYPN_MACHINERY_FAMILY = "Hydraulic & Pneumatic Power Systems";

const HYPN_JOB_CODE_PATTERN = /^HYPN-\d+$/i;

export function isV330TypewiseHypnJobId(jobId: string): boolean {
  return /^JOBS-HYPN-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /hyd.*pneu|hydraulic.*pneumatic|pneumatic.*hydraulic/i.test(name),
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

export function isV330HydraulicPneumaticWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const version = cellStr(row["Repository Version"]);
    const section = cellStr(row["Section"]);
    const machinery = cellStr(row["System / Machinery"]);
    const systemType = cellStr(row["System Type"]);
    return (
      /^V3\.30$/i.test(version) &&
      (/hydraulic|pneumatic|control air/i.test(section) ||
        /hydraulic|pneumatic|control air/i.test(machinery) ||
        /hydraulic|pneumatic/i.test(systemType))
    );
  });
}

export function normalizeV330HypnJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (HYPN_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v330Match = /^V3\.30-HYPN-(\d+)$/i.exec(code);
  if (v330Match) return `JOBS-HYPN-${v330Match[1].padStart(4, "0")}`;
  return "";
}

function formatHypnJobCode(sequence: number): string {
  return `JOBS-HYPN-${String(sequence).padStart(4, "0")}`;
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
  return `HYPN-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "no" || raw === "n" || raw === "pms") return false;
  return raw.startsWith("y") || raw.includes("dry dock") || raw.includes("dry-dock");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const criticality = cellStr(row["Risk / Criticality"] ?? row["Criticality"]);
  if (/^(low|medium|high|critical)$/i.test(criticality)) return criticality;
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const asset = cellStr(row["Equipment / Asset"] ?? row["Asset / Equipment"]);
  const component = cellStr(row["Component"]);
  if (heading && asset) return `${asset} — ${heading}`;
  if (heading && component) return `${component} — ${heading}`;
  return heading || asset || component;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description / Scope"] ?? row["Job Description"]);
  const heading = cellStr(row["Job Heading"]);
  if (!desc || desc.length < 12) return heading || desc;
  return desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["Responsible Rank"] ?? row["PIC"]);
  if (!pic) return "Second Engineer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer")) return "Electrical Officer";
  if (lower.includes("chief officer")) return "Chief Officer";
  if (lower.includes("deck officer")) return "Chief Officer";
  if (lower.includes("master")) return "Master";
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("second engineer") || lower.includes("responsible engineer")) return "Second Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["Responsible Rank"] ?? row["PIC"]).toLowerCase();
  if (pic.includes("chief officer") || pic.includes("deck officer")) return "Deck";
  if (/\beto\b/.test(pic) || pic.includes("electrical officer")) return "Electrical";
  return "Engine";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System / Machinery"] ?? row["System"]);
  if (system) return system;
  const section = cellStr(row["Section"]);
  if (section) return section;
  const asset = cellStr(row["Equipment / Asset"] ?? row["Asset / Equipment"]);
  return asset || V330_HYPN_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const component = cellStr(row["Component"]);
  if (component) return component;
  const asset = cellStr(row["Equipment / Asset"] ?? row["Asset / Equipment"]);
  const systemType = cellStr(row["System Type"]);
  if (asset && systemType) return `${asset} (${systemType})`;
  return asset || "Hydraulic / Pneumatic Equipment";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System / Machinery"] ?? row["System"]).toLowerCase();
  const asset = cellStr(row["Equipment / Asset"] ?? row["Asset / Equipment"]).toLowerCase();
  const systemType = cellStr(row["System Type"]).toLowerCase();
  const combined = `${system} ${asset} ${systemType}`;
  if (/deck machinery|windlass|mooring|capstan|hatch cover|watertight door|cargo hydraulic/i.test(combined)) {
    return "deck workshop";
  }
  if (/lifting|crane|davit/i.test(combined)) return "deck / cargo workshop";
  if (/pneumatic|control air|instrument air/i.test(combined)) return "machinery workshop";
  return "machinery workshop";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/pneumatic|control air|instrument air|receiver|dryer/i.test(combined)) return "Pneumatic System";
  if (/accumulator|relief|filter|strainer|cooler|pump|solenoid/i.test(combined)) {
    return "Hydraulic Component";
  }
  if (/hose|pipe|tubing|fitting/i.test(combined)) return "Hydraulic / Pneumatic Piping";
  if (/gauge|sensor|transmitter|indicator/i.test(combined)) return "Hydraulic / Pneumatic Instrument";
  return "Hydraulic / Pneumatic Equipment";
}

function normalizeV330HypnJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const explicitCode = normalizeV330HypnJobCode(cellStr(row["Job Code"]));
    sequence += 1;
    const jobId = explicitCode || formatHypnJobCode(sequence);

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const dryDock = dryDockFlag(row["Dry-Dock / PMS"] ?? row["Dry Dock Job"]);
    const asset = cellStr(row["Equipment / Asset"] ?? row["Asset / Equipment"]);
    const sourceCode = cellStr(row["Job Code"]);
    const crossRef = cellStr(row["Duplicate Control / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ / Yard Scope Note"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V330_HYPN_MACHINERY_FAMILY,
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
        "RFQ Category": V330_HYPN_MACHINERY_FAMILY,
        "Budget Category": asset || systemName,
        "Cost Code": `DD-${systemCode}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks:
          cellStr(row["Remarks"]) ||
          crossRef ||
          rfqNote ||
          (sourceCode && !explicitCode ? `Source code: ${sourceCode}` : null) ||
          null,
      },
    ];
  });
}

function synthesizeV330HypnMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV330HypnChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV330HypnRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V330_HYPN_MACHINERY_FAMILY;
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

function synthesizeV330HypnEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV330HypnComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV330HypnRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V330_HYPN_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV330HydraulicPneumaticRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV330HydraulicPneumaticWorkbook(workbook)) {
    throw new Error(
      "Not a V3.30 Hydraulic & Pneumatic Power Systems EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.30 Hydraulic/Pneumatic workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV330HypnJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV330HypnMeasurements(masterJobs),
    checklistItems: synthesizeV330HypnChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV330HypnRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV330HypnEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV330HypnComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV330HypnRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV330HydraulicPneumaticRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV330HydraulicPneumaticRepositoryBuffer(bytes);
}

export function parseV330HydraulicPneumaticRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV330HydraulicPneumaticRepositoryFile(path);
  } catch {
    return null;
  }
}
