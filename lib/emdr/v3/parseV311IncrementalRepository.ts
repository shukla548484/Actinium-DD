import * as XLSX from "xlsx";
import fs from "node:fs";
import type { ParsedComponentMasterRow, ParsedEquipmentMasterRow, ParsedToolMasterRow } from "@/lib/emdr/types";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import {
  buildTemplateIdByJobId,
  synthesizeV3ScopeSteps,
  synthesizeV3Templates,
  synthesizeV3Workflows,
  type V3RepositoryIndexRow,
} from "@/lib/emdr/v3/parseV3Rows";
import { EMDR_V311_RELEASE } from "@/lib/emdr/v3/sheets";
import { normalizeWorkbookMasterIds } from "@/lib/mtil/import/normalizeWorkbookMasterIds";
import type {
  ParsedChecklistRow,
  ParsedMasterJobRow,
  ParsedMeasurementRow,
  ParsedMtilWorkbook,
  ParsedRfqRow,
  ParsedSpareRow,
} from "@/lib/mtil/import/parseWorkbook";
import {
  cellStr,
  mapInputType,
  mapPricingBasis,
  mapResponseType,
} from "@/lib/mtil/import/excelValues";
import { MASTER_ENTITY_CODES, normalizeMasterId } from "@/lib/mtil/masterCodeStandard";
import { parseMasterJobs } from "@/lib/mtil/v2/import/parseSprintRows";

const INCREMENTAL_SHEETS = {
  jobs: "Repository_Jobs",
  measurements: "Measurements",
  inspections: "Inspection_Checklist",
  tools: "Tools_PPE",
  spares: "Spares_Consumables",
  rfq: "RFQ_Budget_Mapping",
} as const;

export const V311_MACHINERY_FAMILY = "Fire Fighting Systems";

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function isV311IncrementalWorkbook(workbook: XLSX.WorkBook): boolean {
  const rows = sheetRows(workbook, INCREMENTAL_SHEETS.jobs);
  const code = cellStr(rows[0]?.["Job Code"]);
  return code.startsWith("V3.11-");
}

export function normalizeV311JobCode(raw: string): string {
  const code = cellStr(raw);
  if (code.startsWith("V3.11-")) return `JOBS-${code.slice(6)}`;
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

function normalizeV311EntityId(id: string, entity: keyof typeof MASTER_ENTITY_CODES): string {
  const trimmed = cellStr(id);
  if (trimmed.startsWith("V3.11-")) {
    return `${MASTER_ENTITY_CODES[entity]}-${trimmed.slice(6)}`;
  }
  return normalizeMasterId(trimmed, MASTER_ENTITY_CODES[entity]);
}

function systemCodeFromJobId(jobId: string): string | null {
  const match = jobId.match(/^JOBS-([A-Z]+-\d+)-/);
  return match?.[1] ?? null;
}

function ynBoolLoose(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw) return false;
  return raw === "y" || raw === "yes" || raw === "true" || raw === "1";
}

function normalizeV311JobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const jobId = normalizeV311JobCode(cellStr(row["Job Code"]));
    const systemCode = cellStr(row["System Code"]);
    const ids = idsFromJobId(jobId);
    const machinery = cellStr(row["Machinery Family"]) || V311_MACHINERY_FAMILY;
    const dryDock = cellStr(row["Dry Dock Job"]).toLowerCase();
    return {
      "Job ID": jobId,
      Release: EMDR_V311_RELEASE,
      Department: "Safety",
      Machinery: machinery,
      System: cellStr(row["System Name"]),
      Component: cellStr(row["Component Name"]),
      "Equipment Code": `EQPM-${systemCode}`,
      "Standard Job": cellStr(row["Job Heading"]),
      "Detailed Scope": cellStr(row["Job Description"]),
      "Vessel Types": "All Types",
      "Project Types": dryDock === "yes" ? "Special Survey" : "Occasional Repair",
      Workshop: "ffa workshop",
      "Responsible Vessel Role": cellStr(row["PIC"]) || "Chief Officer",
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": machinery,
      "Budget Category": cellStr(row["Section"]) || "Fire Fighting Systems",
      "Cost Code": `DD-${systemCode}`,
      "Class Hold Point": dryDock === "yes" ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": cellStr(row["Criticality"]) || "Medium",
      "Active Flag": "Y",
    };
  });
}

function parseV311Measurements(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedMeasurementRow[] {
  const parsed: ParsedMeasurementRow[] = [];
  for (const [index, row] of rows.entries()) {
    const measurementId = normalizeV311EntityId(cellStr(row["Measurement ID"]), "MEAS");
    const jobId = normalizeV311JobCode(cellStr(row["Linked Job Code"]));
    if (!measurementId || !jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;
    parsed.push({
      rowNumber: index + 2,
      measurementId,
      measurementSetId: idsFromJobId(jobId).measurementSetId,
      templateId,
      measurementName: cellStr(row["Measurement / Parameter"]),
      unit: cellStr(row["Unit"]) || "—",
      minLimit: null,
      maxLimit: null,
      targetValue: cellStr(row["Expected / Limit"]) || null,
      inputType: mapInputType(row["Unit"] ?? row["Result"]),
      mandatoryFlag: true,
      remarks: cellStr(row["Remarks"]) || null,
    });
  }
  return parsed;
}

function parseV311Checklist(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedChecklistRow[] {
  const seqByChecklist = new Map<string, number>();
  const parsed: ParsedChecklistRow[] = [];
  for (const [index, row] of rows.entries()) {
    const checklistItemId = normalizeV311EntityId(cellStr(row["Checklist ID"]), "INSP");
    const jobId = normalizeV311JobCode(cellStr(row["Linked Job Code"]));
    if (!checklistItemId || !jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;
    const checklistId = idsFromJobId(jobId).inspectionChecklistId;
    const seq = (seqByChecklist.get(checklistId) ?? 0) + 1;
    seqByChecklist.set(checklistId, seq);
    parsed.push({
      rowNumber: index + 2,
      checklistItemId,
      checklistId,
      templateId,
      sequenceNo: seq,
      inspectionItem: cellStr(row["Check Point"]),
      acceptanceCriteria: cellStr(row["Acceptance Criteria"]),
      responseType: mapResponseType(row["Status"] ?? "Pass/Fail/NA"),
      photoRequiredOnFail: ynBoolLoose(row["Photo Required"]),
      mandatoryFlag: true,
      remarks: cellStr(row["Observation"]) || null,
    });
  }
  return parsed;
}

function parseV311Tools(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedToolMasterRow[] {
  return rows
    .map((row, index) => {
      const jobId = normalizeV311JobCode(cellStr(row["Linked Job Code"]));
      if (!jobId) return null;
      const templateId = templateIdByJobId.get(jobId);
      if (!templateId) return null;
      const toolId = `TOOL-${jobId.replace(/^JOBS-/, "")}`;
      return {
        rowNumber: index + 2,
        toolId: normalizeMasterId(toolId, MASTER_ENTITY_CODES.TOOL),
        templateId: normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL),
        toolName: cellStr(row["Tools / PPE Required"]),
        toolType: "Tools & PPE",
        mandatory: true,
        remarks: cellStr(row["Permit / Safety Note"] ?? row["Special Equipment"]) || null,
      };
    })
    .filter((row): row is ParsedToolMasterRow => row !== null);
}

function parseV311Spares(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedSpareRow[] {
  const parsed: ParsedSpareRow[] = [];
  for (const [index, row] of rows.entries()) {
    const jobId = normalizeV311JobCode(cellStr(row["Linked Job Code"]));
    if (!jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;
    const spareMapId = `SPAR-${jobId.replace(/^JOBS-/, "")}`;
    const consumables = cellStr(row["Spares / Consumables"]);
    if (!consumables) continue;
    parsed.push({
      rowNumber: index + 2,
      spareMapId,
      jobId,
      templateId,
      itemType: "consumable",
      itemName: consumables,
      quantityBasis: "per_job",
      recommendedQty: null,
      ownerSupplyFlag: false,
      yardSupplyFlag: false,
      remarks: cellStr(row["RFQ Notes"]) || null,
    });
  }
  return parsed;
}

function parseV311Rfq(rows: Array<Record<string, unknown>>): ParsedRfqRow[] {
  return rows
    .map((row, index) => {
      const jobId = normalizeV311JobCode(cellStr(row["Linked Job Code"]));
      if (!jobId) return null;
      const mappingId = `RFQM-${jobId.replace(/^JOBS-/, "")}`;
      const budgetCategory = cellStr(row["Budget Category"]) || "Fire Fighting Systems Jobs Cost";
      return {
        rowNumber: index + 2,
        mappingId,
        jobId,
        rfqSection: budgetCategory,
        quoteComparisonSection: cellStr(row["RFQ Scope Text"]) || budgetCategory,
        budgetCategory,
        costCode: cellStr(row["Dry Dock Package"]) || budgetCategory,
        workshop: "ffa workshop",
        pricingBasis: mapPricingBasis(row["Pricing Basis"]),
        discountApplicable: ynBoolLoose(row["Discount Applicable"]),
        netItemFlag: ynBoolLoose(row["Net Item"]),
      };
    })
    .filter((row): row is ParsedRfqRow => row !== null);
}

function synthesizeV311EquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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
      department: "Safety",
      vesselType: "All Types",
      remarks: null,
    });
  }
  return rows;
}

function synthesizeV311ComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
  const seen = new Set<string>();
  const rows: ParsedComponentMasterRow[] = [];
  for (const [index, job] of jobs.entries()) {
    const systemCode = systemCodeFromJobId(job.jobId);
    const componentTail = job.jobId.replace(/^JOBS-/, "").split("-").slice(2, 3)[0];
    if (!systemCode || !componentTail) continue;
    const componentCode = `COMP-${systemCode}-${componentTail}`;
    if (seen.has(componentCode)) continue;
    seen.add(componentCode);
    const equipmentCode = job.subComponent ?? `EQPM-${systemCode}`;
    rows.push({
      rowNumber: index + 2,
      componentCode,
      equipmentCode,
      componentName: job.component,
      componentType: "Fire Fighting System",
      activeFlag: true,
      system: job.systemGroup,
      owner: null,
    });
  }
  return rows;
}

function buildV311RepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
  const bySystem = new Map<string, { systemName: string; count: number }>();
  for (const job of jobs) {
    const systemCode = systemCodeFromJobId(job.jobId);
    if (!systemCode) continue;
    const entry = bySystem.get(systemCode) ?? { systemName: job.systemGroup, count: 0 };
    entry.count += 1;
    bySystem.set(systemCode, entry);
  }
  return [...bySystem.entries()].map(([systemCode, entry]) => ({
    systemCode,
    systemName: entry.systemName,
    jobCount: entry.count,
    status: "Completed",
    machineryFamily: V311_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV311IncrementalRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV311IncrementalWorkbook(workbook)) {
    throw new Error("Not a V3.11 incremental EMDR repository workbook");
  }

  const jobRows = normalizeV311JobRows(sheetRows(workbook, INCREMENTAL_SHEETS.jobs));
  const masterJobs = parseMasterJobs(jobRows).map((job) => ({
    ...job,
    libraryVersion: EMDR_V311_RELEASE,
  }));

  const templates = synthesizeV3Templates(masterJobs);
  const workflows = synthesizeV3Workflows(templates, masterJobs);
  const scopeSteps = synthesizeV3ScopeSteps(masterJobs);
  const templateIdByJobId = buildTemplateIdByJobId(masterJobs);

  const parsed: ParsedMtilWorkbook = {
    libraryVersion: EMDR_V311_RELEASE,
    masterJobs,
    templates,
    measurements: parseV311Measurements(
      sheetRows(workbook, INCREMENTAL_SHEETS.measurements),
      templateIdByJobId,
    ),
    checklistItems: parseV311Checklist(
      sheetRows(workbook, INCREMENTAL_SHEETS.inspections),
      templateIdByJobId,
    ),
    scopeSteps,
    attachments: [],
    spares: parseV311Spares(sheetRows(workbook, INCREMENTAL_SHEETS.spares), templateIdByJobId),
    rfqMappings: parseV311Rfq(sheetRows(workbook, INCREMENTAL_SHEETS.rfq)),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV311EquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV311ComponentMaster(normalized.masterJobs),
      tools: parseV311Tools(sheetRows(workbook, INCREMENTAL_SHEETS.tools), templateIdByJobId),
    },
    repositoryIndex: buildV311RepositoryIndex(normalized.masterJobs),
    release: EMDR_V311_RELEASE,
  };
}

export function parseV311IncrementalRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV311IncrementalRepositoryBuffer(bytes);
}

export function parseV311IncrementalRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV311IncrementalRepositoryFile(path);
  } catch {
    return null;
  }
}
