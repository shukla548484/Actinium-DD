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

const MASTER_SHEET = "PMS_DryDock_Jobs";

export const V322_EPD_MACHINERY_FAMILY = "Electrical Power Generation & Distribution";

const EPD_JOB_CODE_PATTERN = /^EPD-\d+$/i;

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV322ElectricalPowerWorkbook(workbook: XLSX.WorkBook): boolean {
  if (!workbook.SheetNames.includes(MASTER_SHEET)) return false;
  const rows = sheetRows(workbook, MASTER_SHEET);
  const code = cellStr(rows[0]?.["Job Code"]).replace(/^JOBS-/, "");
  return EPD_JOB_CODE_PATTERN.test(code);
}

export function normalizeV322EpdJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (!EPD_JOB_CODE_PATTERN.test(code)) return "";
  return `JOBS-${code.toUpperCase()}`;
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
  return `EPD-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "pms") return false;
  return raw.includes("dry dock") || raw.startsWith("yes");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const risk = cellStr(row["Risk Level"]);
  if (/^(low|medium|high|critical)$/i.test(risk)) return risk;
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  return cellStr(row["Job Heading"]) || cellStr(row["Job Action"]);
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"]);
  const heading = cellStr(row["Job Heading"]);
  if (!desc || desc.length < 12) return heading || desc;
  return desc;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"]);
  if (!pic) return "Electrical Officer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const section = cellStr(row["Section"]);
  if (section) return section;
  const asset = cellStr(row["Asset / Equipment"]);
  if (asset) return asset;
  return V322_EPD_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const component = cellStr(row["Component / Subsystem"]);
  if (component) return component;
  const asset = cellStr(row["Asset / Equipment"]);
  if (asset) return asset;
  const equipmentType = cellStr(row["Equipment Type"]);
  return equipmentType || "Electrical Power Equipment";
}

function normalizeV322EpdJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;

  return rows.flatMap((row) => {
    const jobId = normalizeV322EpdJobCode(cellStr(row["Job Code"]));
    if (!jobId) return [];

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V322_EPD_MACHINERY_FAMILY;
    const dryDock = dryDockFlag(row["Dry Dock / PMS"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: "Electrical",
        Machinery: /electrical power generation|distribution/i.test(machinery)
          ? V322_EPD_MACHINERY_FAMILY
          : machinery,
        System: systemName,
        Component: componentFromRow(row),
        "Equipment Code": `EQPM-${systemCode}`,
        "Standard Job": standardJobFromRow(row),
        "Detailed Scope": detailedScopeFromRow(row),
        "Vessel Types": "All Types",
        "Project Types": dryDock ? "Special Survey" : "Occasional Repair",
        Workshop: "electrical workshop",
        "Responsible Vessel Role": picFromRow(row),
        "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
        "Approval Role": "Technical Superintendent",
        "Template ID": ids.templateId,
        "Measurement Set ID": ids.measurementSetId,
        "Inspection Set ID": ids.inspectionChecklistId,
        "Scope of Work ID": ids.scopeOfWorkId,
        "RFQ Category": V322_EPD_MACHINERY_FAMILY,
        "Budget Category": cellStr(row["Section"]) || "Electrical Power",
        "Cost Code": `DD-${systemCode}`,
        "Class Hold Point": dryDock ? "Y" : "N",
        "Maker Attendance": "N",
        "Risk Level": riskLevelFromRow(row),
        "Active Flag": "Y",
        Remarks: cellStr(row["Remarks"]) || null,
      },
    ];
  });
}

function synthesizeV322EpdMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV322EpdChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
  return masterJobs.map((job, index) => {
    const ids = idsFromJobId(job.jobId);
    return {
      rowNumber: index + 2,
      checklistItemId: `${ids.inspectionChecklistId}-01`,
      checklistId: ids.inspectionChecklistId,
      templateId: job.templateId,
      sequenceNo: 1,
      inspectionItem: job.standardJobName,
      acceptanceCriteria: job.jobDescription || "Complete per maker manual, class rules and PMS",
      responseType: "pass_fail_na" as const,
      photoRequiredOnFail: true,
      mandatoryFlag: true,
      remarks: null,
    };
  });
}

function synthesizeV322EpdRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job, index) => {
    const budgetCategory = job.budgetCategory || "Electrical Power";
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

function synthesizeV322EpdEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV322EpdComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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
      componentType: "Electrical Power",
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV322EpdRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
  const bySystem = new Map<string, { systemName: string; machinery: string; count: number }>();
  for (const job of jobs) {
    const systemName = job.systemGroup;
    if (!systemName) continue;
    const entry = bySystem.get(systemName) ?? { systemName, machinery: job.machinery, count: 0 };
    entry.count += 1;
    bySystem.set(systemName, entry);
  }
  return [...bySystem.entries()].map(([systemName, entry], index) => ({
    systemCode: systemCodeForSystemName(systemName, index),
    systemName: entry.systemName,
    jobCount: entry.count,
    status: "Completed",
    machineryFamily: V322_EPD_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV322ElectricalPowerRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV322ElectricalPowerWorkbook(workbook)) {
    throw new Error(
      "Not a V3.22 Electrical Power Generation & Distribution EMDR repository workbook",
    );
  }

  const jobRows = normalizeV322EpdJobRows(sheetRows(workbook, MASTER_SHEET));
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
    measurements: synthesizeV322EpdMeasurements(masterJobs),
    checklistItems: synthesizeV322EpdChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV322EpdRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV322EpdEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV322EpdComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV322EpdRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV322ElectricalPowerRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV322ElectricalPowerRepositoryBuffer(bytes);
}

export function parseV322ElectricalPowerRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV322ElectricalPowerRepositoryFile(path);
  } catch {
    return null;
  }
}
