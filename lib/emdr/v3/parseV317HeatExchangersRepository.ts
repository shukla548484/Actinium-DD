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

const MASTER_SHEET = "HeatExchanger_Jobs";

export const V317_HEX_MACHINERY_FAMILY = "Heat Exchangers / Coolers / Heaters / Condensers";

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV317HeatExchangersWorkbook(workbook: XLSX.WorkBook): boolean {
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]);
  return code.startsWith("HEX-");
}

export function normalizeV317HexJobCode(raw: string): string {
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
  return `HEX-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "pms" || raw === "repository control") return false;
  return raw.includes("dry dock") || raw.startsWith("yes");
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
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const jobType = cellStr(row["Job Type"]);
  if (!desc || desc === "Months" || desc.length < 12) return jobType || desc;
  return desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["Responsibility / PIC"] ?? row["PIC"]);
  if (!pic) return "Second Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["System"]);
  if (system && !/^all systems$/i.test(system) && !/^various$/i.test(system)) return system;
  const equipment = cellStr(row["Equipment / Asset"]);
  if (equipment) return equipment;
  return "Heat Exchangers / Coolers / Heaters / Condensers";
}

function normalizeV317HexJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.map((row) => {
    const jobId = normalizeV317HexJobCode(cellStr(row["Job Code"]));
    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V317_HEX_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Dry Dock / PMS"] ?? row["Dry Dock Scope"]);
    return {
      "Job ID": jobId,
      Release: EMDR_V312_RELEASE,
      Department: "Engine",
      Machinery: /heat exchanger|cooler|heater|condenser/i.test(machinery)
        ? V317_HEX_MACHINERY_FAMILY
        : machinery,
      System: systemName,
      Component: cellStr(row["Component"]),
      "Equipment Code": `EQPM-${systemCode}`,
      "Standard Job": standardJobFromRow(row),
      "Detailed Scope": detailedScopeFromRow(row),
      "Vessel Types": "All Types",
      "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
      Workshop: "engine room / heat exchanger / workshop",
      "Responsible Vessel Role": picFromRow(row),
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": V317_HEX_MACHINERY_FAMILY,
      "Budget Category": cellStr(row["Equipment Type / Arrangement"]) || "Heat Exchangers",
      "Cost Code": `DD-${systemCode}`,
      "Class Hold Point": dryDock ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": riskLevelFromRow(row),
      "Active Flag": "Y",
      Remarks: cellStr(row["Remarks"]) || null,
    };
  });
}

function synthesizeV317HexMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV317HexChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV317HexRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || "Heat Exchangers";
    return {
      rowNumber: index + 2,
      mappingId: `RFQM-${job.jobId.replace(/^JOBS-/, "")}`,
      jobId: job.jobId,
      rfqSection: budgetCategory,
      quoteComparisonSection: budgetCategory,
      budgetCategory,
      costCode: budgetCategory,
      workshop: "engine room / heat exchanger / workshop",
      pricingBasis: mapPricingBasis("lump_sum"),
      discountApplicable: false,
      netItemFlag: false,
    };
  });
}

function synthesizeV317HexEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV317HexComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: "Heat Exchanger",
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV317HexRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V317_HEX_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV317HeatExchangersRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV317HeatExchangersWorkbook(workbook)) {
    throw new Error("Not a V3.17 Heat Exchangers typewise EMDR repository workbook");
  }

  const jobRows = normalizeV317HexJobRows(sheetRows(workbook, MASTER_SHEET));
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
    measurements: synthesizeV317HexMeasurements(masterJobs),
    checklistItems: synthesizeV317HexChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV317HexRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV317HexEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV317HexComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV317HexRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV317HeatExchangersRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV317HeatExchangersRepositoryBuffer(bytes);
}

export function parseV317HeatExchangersRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV317HeatExchangersRepositoryFile(path);
  } catch {
    return null;
  }
}
