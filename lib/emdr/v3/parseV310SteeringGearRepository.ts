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

const MASTER_SHEET = "Master_Repository";

export const V310_STG_MACHINERY_FAMILY = "Steering Gear System";

const V310_STG_JOB_PREFIXES = ["STG", "RUD", "ANO", "ICCP", "MGPS", "ANC", "VRCS"] as const;

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV310SteeringGearWorkbook(workbook: XLSX.WorkBook): boolean {
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]);
  return V310_STG_JOB_PREFIXES.some((prefix) => code.startsWith(`${prefix}-`));
}

export function normalizeV310StgJobCode(raw: string): string {
  const code = cellStr(raw);
  if (code.startsWith("JOBS-")) return code;
  return `JOBS-${code}`;
}

function jobCodePrefix(jobId: string): string {
  const raw = jobId.replace(/^JOBS-/, "");
  return raw.split("-")[0] || "STG";
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

function systemCodeForSystemName(name: string, index: number, prefix: string): string {
  const base = slug(name, 20).toUpperCase().replace(/_/g, "-") || `SYS-${index + 1}`;
  return `${prefix}-${base}`;
}

function workshopForMachineryFamily(family: string): string {
  if (/steering gear/i.test(family)) return "steering gear room";
  if (/rudder|anode|cathodic/i.test(family)) return "hull workshop";
  if (/iccp|mgps|vrcs/i.test(family)) return "electrical workshop";
  if (/mooring|anchor/i.test(family)) return "fore/aft deck / mast";
  return "machinery workshop";
}

function departmentForMachineryFamily(family: string): string {
  if (/mooring|anchor|rudder/i.test(family)) return "Deck";
  if (/anode|cathodic/i.test(family)) return "Hull";
  if (/iccp|mgps|vrcs/i.test(family)) return "Electrical";
  return "Engine";
}

function componentTypeForFamily(family: string): string {
  if (/steering gear/i.test(family)) return "Steering Gear";
  if (/rudder/i.test(family)) return "Rudder";
  if (/anode|cathodic/i.test(family)) return "Cathodic Protection";
  if (/iccp/i.test(family)) return "ICCP";
  if (/mgps|anti-fouling/i.test(family)) return "MGPS";
  if (/mooring|anchor/i.test(family)) return "Anchoring";
  if (/valve remote|vrcs/i.test(family)) return "VRCS";
  return "Steering Gear";
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  return raw.startsWith("yes");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const criticality = cellStr(row["Criticality"]);
  if (/^(low|medium|high|critical)$/i.test(criticality)) return criticality;
  const trigger = cellStr(row["Trigger / Basis"]);
  if (/^(low|medium|high|critical)$/i.test(trigger)) return trigger;
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  return cellStr(row["Job Heading"]) || cellStr(row["Job Type"]);
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description / Scope"]);
  const jobType = cellStr(row["Job Type"]);
  if (!desc || desc === "Months" || desc.length < 12) return jobType || desc;
  return desc;
}

function normalizeV310StgJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.map((row) => {
    const jobId = normalizeV310StgJobCode(cellStr(row["Job Code"]));
    const prefix = jobCodePrefix(jobId);
    const systemName = cellStr(row["Machinery / System"]);
    const systemKey = `${prefix}:${systemName}`;
    let systemCode = systemCodes.get(systemKey);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++, prefix);
      systemCodes.set(systemKey, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V310_STG_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Dry Dock Scope"]);
    return {
      "Job ID": jobId,
      Release: EMDR_V312_RELEASE,
      Department: departmentForMachineryFamily(machinery),
      Machinery: machinery,
      System: systemName,
      Component: cellStr(row["Component / Sub-Component"]),
      "Equipment Code": `EQPM-${systemCode}`,
      "Standard Job": standardJobFromRow(row),
      "Detailed Scope": detailedScopeFromRow(row),
      "Vessel Types": "All Types",
      "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
      Workshop: workshopForMachineryFamily(machinery),
      "Responsible Vessel Role": cellStr(row["PIC"]) || "Second Engineer",
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": machinery,
      "Budget Category": cellStr(row["Section"]) || "Steering Gear System",
      "Cost Code": `DD-${systemCode}`,
      "Class Hold Point": dryDock ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": riskLevelFromRow(row),
      "Active Flag": "Y",
    };
  });
}

function synthesizeV310StgMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV310StgChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      checklistItemId: `${ids.inspectionChecklistId}-01`,
      checklistId: ids.inspectionChecklistId,
      templateId: job.templateId,
      sequenceNo: 1,
      inspectionItem: job.standardJobName,
      acceptanceCriteria: job.jobDescription || "Complete per maker manual and PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV310StgRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || `${job.machinery} Jobs Cost`;
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

function synthesizeV310StgEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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
      department: "Engine",
      vesselType: "All Types",
      remarks: null,
    });
  }
  return rows;
}

function synthesizeV310StgComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: componentTypeForFamily(job.machinery),
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV310StgRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
  const bySystem = new Map<string, { systemName: string; count: number; machinery: string; prefix: string }>();
  for (const job of jobs) {
    const systemName = job.systemGroup;
    if (!systemName) continue;
    const key = `${job.machinery}|${systemName}`;
    const entry = bySystem.get(key) ?? {
      systemName,
      count: 0,
      machinery: job.machinery,
      prefix: jobCodePrefix(job.jobId),
    };
    entry.count += 1;
    bySystem.set(key, entry);
  }
  let index = 0;
  return [...bySystem.values()].map((entry) => ({
    systemCode: systemCodeForSystemName(entry.systemName, index++, entry.prefix),
    systemName: entry.systemName,
    jobCount: entry.count,
    status: "Completed",
    machineryFamily:
      entry.machinery === V310_STG_MACHINERY_FAMILY
        ? (V310_STG_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"])
        : undefined,
  }));
}

export function parseV310SteeringGearRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV310SteeringGearWorkbook(workbook)) {
    throw new Error("Not a V3.10 Steering Gear typewise EMDR repository workbook");
  }

  const jobRows = normalizeV310StgJobRows(sheetRows(workbook, MASTER_SHEET));
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
    measurements: synthesizeV310StgMeasurements(masterJobs),
    checklistItems: synthesizeV310StgChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV310StgRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV310StgEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV310StgComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV310StgRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV310SteeringGearRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV310SteeringGearRepositoryBuffer(bytes);
}

export function parseV310SteeringGearRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV310SteeringGearRepositoryFile(path);
  } catch {
    return null;
  }
}
