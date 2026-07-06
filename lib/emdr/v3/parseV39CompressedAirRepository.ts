import * as XLSX from "xlsx";
import fs from "node:fs";
import type { ParsedComponentMasterRow, ParsedEquipmentMasterRow } from "@/lib/emdr/types";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import {
  buildTemplateIdByJobId,
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
  ParsedMtilWorkbook,
  ParsedRfqRow,
} from "@/lib/mtil/import/parseWorkbook";
import { cellStr, mapPricingBasis } from "@/lib/mtil/import/excelValues";
import { MASTER_ENTITY_CODES, normalizeMasterId } from "@/lib/mtil/masterCodeStandard";
import { parseMasterJobs } from "@/lib/mtil/v2/import/parseSprintRows";

const MASTER_SHEET = "Master_Repository";

export const V39_CAS_MACHINERY_FAMILY = "Compressed Air & Starting Air System";

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV39CompressedAirWorkbook(workbook: XLSX.WorkBook): boolean {
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]);
  return code.startsWith("ACSA-");
}

export function normalizeV39CasJobCode(raw: string): string {
  const code = cellStr(raw);
  if (code.startsWith("ACSA-")) return `JOBS-${code}`;
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
  return `ACSA-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  return raw.startsWith("yes");
}

function normalizeV39CasJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.map((row) => {
    const jobId = normalizeV39CasJobCode(cellStr(row["Job Code"]));
    const systemName = cellStr(row["Machinery / System"]);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V39_CAS_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Dry Dock Scope"]);
    return {
      "Job ID": jobId,
      Release: EMDR_V312_RELEASE,
      Department: "Engine",
      Machinery: machinery,
      System: systemName,
      Component: cellStr(row["Component / Sub-Component"]),
      "Equipment Code": `EQPM-${systemCode}`,
      "Standard Job": cellStr(row["Job Heading"]),
      "Detailed Scope": cellStr(row["Job Description / Scope"]),
      "Vessel Types": "All Types",
      "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
      Workshop: "engine room",
      "Responsible Vessel Role": cellStr(row["PIC"]) || "Second Engineer",
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": machinery,
      "Budget Category": cellStr(row["Section"]) || "Compressed Air & Starting Air",
      "Cost Code": `DD-${systemCode}`,
      "Class Hold Point": dryDock ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": cellStr(row["Criticality"]) || "Medium",
      "Active Flag": "Y",
    };
  });
}

function synthesizeV39CasChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
  return masterJobs.map((job, index) => ({
    rowNumber: index + 2,
    checklistItemId: `${job.templateId.replace(/^TMPL-/, "INSP-")}-01`,
    checklistId: job.templateId.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.INSP}-`),
    templateId: job.templateId,
    sequenceNo: 1,
    inspectionItem: job.standardJobName,
    acceptanceCriteria: job.jobDescription || "Complete per maker manual and PMS",
    responseType: "pass_fail_na",
    photoRequiredOnFail: true,
    mandatoryFlag: true,
    remarks: null,
  }));
}

function synthesizeV39CasRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || "Compressed Air & Starting Air Jobs Cost";
    return {
      rowNumber: index + 2,
      mappingId: `RFQM-${job.jobId.replace(/^JOBS-/, "")}`,
      jobId: job.jobId,
      rfqSection: budgetCategory,
      quoteComparisonSection: budgetCategory,
      budgetCategory,
      costCode: budgetCategory,
      workshop: "engine room",
      pricingBasis: mapPricingBasis("lump_sum"),
      discountApplicable: false,
      netItemFlag: false,
    };
  });
}

function synthesizeV39CasEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV39CasComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: "Compressed Air System",
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV39CasRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V39_CAS_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV39CompressedAirRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV39CompressedAirWorkbook(workbook)) {
    throw new Error("Not a V3.9 Compressed Air / Starting Air EMDR repository workbook");
  }

  const jobRows = normalizeV39CasJobRows(sheetRows(workbook, MASTER_SHEET));
  const masterJobs = parseMasterJobs(jobRows).map((job) => ({
    ...job,
    libraryVersion: EMDR_V312_RELEASE,
  }));

  const templates = synthesizeV3Templates(masterJobs);
  const workflows = synthesizeV3Workflows(templates, masterJobs);
  const scopeSteps = synthesizeV3ScopeSteps(masterJobs);
  const templateIdByJobId = buildTemplateIdByJobId(masterJobs);

  const parsed: ParsedMtilWorkbook = {
    libraryVersion: EMDR_V312_RELEASE,
    masterJobs,
    templates,
    measurements: [],
    checklistItems: synthesizeV39CasChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV39CasRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV39CasEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV39CasComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV39CasRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV39CompressedAirRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV39CompressedAirRepositoryBuffer(bytes);
}

export function parseV39CompressedAirRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV39CompressedAirRepositoryFile(path);
  } catch {
    return null;
  }
}
