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

export const V314_EMO_MACHINERY_FAMILY = "Electrical Motors / Motor Overhauling";

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV314ElectricalMotorsWorkbook(workbook: XLSX.WorkBook): boolean {
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]);
  return code.startsWith("EMO-");
}

export function normalizeV314EmoJobCode(raw: string): string {
  const code = cellStr(raw);
  if (code.startsWith("JOBS-")) return code;
  return `JOBS-${code}`;
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
  return `EMO-${base}`;
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

function normalizeV314EmoJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.map((row) => {
    const jobId = normalizeV314EmoJobCode(cellStr(row["Job Code"]));
    const systemName = cellStr(row["Machinery / System"]);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V314_EMO_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Dry Dock Scope"]);
    return {
      "Job ID": jobId,
      Release: EMDR_V312_RELEASE,
      Department: "Electrical",
      Machinery: /electrical motor/i.test(machinery) ? V314_EMO_MACHINERY_FAMILY : machinery,
      System: systemName,
      Component: cellStr(row["Component / Sub-Component"]),
      "Equipment Code": `EQPM-${systemCode}`,
      "Standard Job": standardJobFromRow(row),
      "Detailed Scope": detailedScopeFromRow(row),
      "Vessel Types": "All Types",
      "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
      Workshop: "electrical workshop",
      "Responsible Vessel Role": cellStr(row["PIC"]) || "Electrical Officer",
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": V314_EMO_MACHINERY_FAMILY,
      "Budget Category": cellStr(row["Section"]) || "Electrical Motors",
      "Cost Code": `DD-${systemCode}`,
      "Class Hold Point": dryDock ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": riskLevelFromRow(row),
      "Active Flag": "Y",
    };
  });
}

function synthesizeV314EmoMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV314EmoChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV314EmoRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || "Electrical Motors Jobs Cost";
    return {
      rowNumber: index + 2,
      mappingId: `RFQM-${job.jobId.replace(/^JOBS-/, "")}`,
      jobId: job.jobId,
      rfqSection: budgetCategory,
      quoteComparisonSection: budgetCategory,
      budgetCategory,
      costCode: budgetCategory,
      workshop: "electrical workshop",
      pricingBasis: mapPricingBasis("lump_sum"),
      discountApplicable: false,
      netItemFlag: false,
    };
  });
}

function synthesizeV314EmoEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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
      department: "Electrical",
      vesselType: "All Types",
      remarks: null,
    });
  }
  return rows;
}

function synthesizeV314EmoComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: "Electrical Motor",
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV314EmoRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V314_EMO_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV314ElectricalMotorsRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV314ElectricalMotorsWorkbook(workbook)) {
    throw new Error("Not a V3.14 Electrical Motors typewise EMDR repository workbook");
  }

  const jobRows = normalizeV314EmoJobRows(sheetRows(workbook, MASTER_SHEET));
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
    measurements: synthesizeV314EmoMeasurements(masterJobs),
    checklistItems: synthesizeV314EmoChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV314EmoRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV314EmoEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV314EmoComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV314EmoRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV314ElectricalMotorsRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV314ElectricalMotorsRepositoryBuffer(bytes);
}

export function parseV314ElectricalMotorsRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV314ElectricalMotorsRepositoryFile(path);
  } catch {
    return null;
  }
}
