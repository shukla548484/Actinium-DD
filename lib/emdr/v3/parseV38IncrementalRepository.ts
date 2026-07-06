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
import { EMDR_V38_RELEASE } from "@/lib/emdr/v3/sheets";
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

export const V38_INCREMENTAL_SHEETS = {
  jobs: "PMS_Jobs",
  systems: "Systems",
  components: "Components",
  measurements: "Measurements",
  inspections: "Inspection_Checklists",
  tools: "Tools_PPE",
  spares: "Spares_Consumables",
  rfq: "RFQ_Budget_Map",
} as const;

const JOB_TYPE_LABELS: Record<string, string> = {
  C: "Condition check",
  M: "Measurement",
  O: "Overhaul",
  R: "Renewal",
  T: "Test",
  P: "Performance test",
  A: "Adjustment",
};

export function isV38IncrementalWorkbook(workbook: XLSX.WorkBook): boolean {
  return Boolean(workbook.Sheets[V38_INCREMENTAL_SHEETS.jobs]);
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function normalizeV38JobId(raw: string): string {
  const code = cellStr(raw);
  if (code.startsWith("V38-JOB-")) return `JOBS-V38-${code.slice(8)}`;
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

function normalizeV38EntityId(id: string, entity: keyof typeof MASTER_ENTITY_CODES): string {
  const trimmed = cellStr(id);
  if (trimmed.startsWith("V38-")) {
    return `${MASTER_ENTITY_CODES[entity]}-V38-${trimmed.slice(4)}`;
  }
  return normalizeMasterId(trimmed, MASTER_ENTITY_CODES[entity]);
}

function mapPicRole(value: unknown): string {
  const raw = cellStr(value);
  if (raw === "2/E" || /2\/e/i.test(raw)) return "Second Engineer";
  if (/ch\.\s*engr/i.test(raw) && /supt/i.test(raw)) return "Chief Engineer";
  if (/ch\.\s*engr/i.test(raw) && /class/i.test(raw)) return "Chief Engineer";
  if (/shipyard/i.test(raw) && /maker/i.test(raw)) return "Shipyard Planner";
  if (/shipyard/i.test(raw)) return "Shipyard Planner";
  if (/supt/i.test(raw)) return "Technical Superintendent";
  return raw || "Second Engineer";
}

function mapMachineryFamily(value: unknown): string {
  const raw = cellStr(value);
  if (raw === "Air Conditioning & Refrigeration") return "Air Conditioning & Ventilation";
  return raw || "Fresh Water Generator";
}

function normalizeV38JobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
    const systemId = cellStr(row["System ID"]);
    const ids = idsFromJobId(jobId);
    const machinery = mapMachineryFamily(row["Machinery Family"]);
    const jobType = cellStr(row["Job Type"]);
    const component = cellStr(row["Component"]);
    const dryDock = cellStr(row["Dry Dock Job"]).toLowerCase();
    return {
      "Job ID": jobId,
      Release: EMDR_V38_RELEASE,
      Department: "Engine",
      Machinery: machinery,
      System: cellStr(row["System / Equipment"]),
      Component: component,
      "Equipment Code": systemId ? normalizeMasterId(systemId, MASTER_ENTITY_CODES.EQPM) : "",
      "Standard Job": `${component} - ${JOB_TYPE_LABELS[jobType] ?? jobType}`,
      "Detailed Scope": cellStr(row["Job Description"]),
      "Vessel Types": "All Types",
      "Project Types": dryDock === "yes" ? "Special Survey" : "Occasional Repair",
      Workshop: "Machinery Workshop",
      "Responsible Vessel Role": mapPicRole(row["PIC"]),
      "Review Role": cellStr(row["Verifying Authority"]) || "Chief Engineer",
      "Approval Role": "Technical Superintendent",
      "Template ID": ids.templateId,
      "Measurement Set ID": ids.measurementSetId,
      "Inspection Set ID": ids.inspectionChecklistId,
      "Scope of Work ID": ids.scopeOfWorkId,
      "RFQ Category": cellStr(row["Machinery Family"]) || machinery,
      "Budget Category": machinery,
      "Cost Code": systemId ? `DD-${systemId.replace(/^V38-SYS-/, "V38-")}` : machinery,
      "Class Hold Point": dryDock === "yes" ? "Y" : "N",
      "Maker Attendance": "N",
      "Risk Level": cellStr(row["Priority"]) || "Medium",
      "Active Flag": "Y",
    };
  });
}

function parseV38Measurements(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedMeasurementRow[] {
  const parsed: ParsedMeasurementRow[] = [];
  for (const [index, row] of rows.entries()) {
    const measurementId = normalizeV38EntityId(cellStr(row["Measurement ID"]), "MEAS");
    const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
    if (!measurementId || !jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;
    parsed.push({
      rowNumber: index + 2,
      measurementId,
      measurementSetId: idsFromJobId(jobId).measurementSetId,
      templateId,
      measurementName: cellStr(row["Parameter"]),
      unit: cellStr(row["Record Stage"]) || "—",
      minLimit: null,
      maxLimit: null,
      targetValue: cellStr(row["Evidence Required"]) || null,
      inputType: mapInputType(row["Parameter"]),
      mandatoryFlag: true,
      remarks: null,
    });
  }
  return parsed;
}

function parseV38Checklist(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedChecklistRow[] {
  const seqByChecklist = new Map<string, number>();
  const parsed: ParsedChecklistRow[] = [];
  for (const [index, row] of rows.entries()) {
    const checklistItemId = normalizeV38EntityId(cellStr(row["Checklist ID"]), "INSP");
    const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
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
      inspectionItem: cellStr(row["Inspection Check"]),
      acceptanceCriteria: cellStr(row["Mandatory"]) || "As per PMS",
      responseType: mapResponseType("Pass/Fail/NA"),
      photoRequiredOnFail: false,
      mandatoryFlag: /mandatory/i.test(cellStr(row["Mandatory"])),
      remarks: null,
    });
  }
  return parsed;
}

function parseV38Tools(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedToolMasterRow[] {
  return rows
    .map((row, index) => {
      const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
      if (!jobId) return null;
      const templateId = templateIdByJobId.get(jobId);
      if (!templateId) return null;
      const toolId = normalizeV38EntityId(cellStr(row["Tools ID"]) || `V38-TLS-${jobId.replace(/^JOBS-V38-/, "")}`, "TOOL");
      return {
        rowNumber: index + 2,
        toolId,
        templateId: normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL),
        toolName: cellStr(row["Tools / Equipment Required"]),
        toolType: cellStr(row["PPE Required"]) ? "Tools & PPE" : "Tool",
        mandatory: true,
        remarks: cellStr(row["PPE Required"]) || null,
      };
    })
    .filter((row): row is ParsedToolMasterRow => row !== null);
}

function parseV38Spares(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedSpareRow[] {
  const parsed: ParsedSpareRow[] = [];
  for (const [index, row] of rows.entries()) {
    const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
    if (!jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;
    const spareMapId = normalizeV38EntityId(cellStr(row["Spares ID"]) || `V38-SPR-${jobId.replace(/^JOBS-V38-/, "")}`, "SPAR");
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
      remarks: cellStr(row["Supply Basis"]) || null,
    });
  }
  return parsed;
}

function parseV38Rfq(rows: Array<Record<string, unknown>>): ParsedRfqRow[] {
  return rows
    .map((row, index) => {
      const jobId = normalizeV38JobId(cellStr(row["Job ID"]));
      if (!jobId) return null;
      const mappingId = normalizeV38EntityId(cellStr(row["RFQ Map ID"]) || `V38-RFQ-${jobId.replace(/^JOBS-V38-/, "")}`, "RFQM");
      const budgetCategory = cellStr(row["Budget Category"]) || "Machinery dry dock overhaul";
      const rfqScope = cellStr(row["RFQ Scope"]);
      return {
        rowNumber: index + 2,
        mappingId,
        jobId,
        rfqSection: cellStr(row["Machinery Family"]) || budgetCategory,
        quoteComparisonSection: rfqScope || budgetCategory,
        budgetCategory,
        costCode: budgetCategory,
        workshop: "Machinery Workshop",
        pricingBasis: mapPricingBasis("Lump sum"),
        discountApplicable: false,
        netItemFlag: false,
      };
    })
    .filter((row): row is ParsedRfqRow => row !== null);
}

function parseV38EquipmentMaster(rows: Array<Record<string, unknown>>): ParsedEquipmentMasterRow[] {
  return rows
    .map((row, index) => {
      const systemId = cellStr(row["System ID"]);
      if (!systemId) return null;
      return {
        rowNumber: index + 2,
        equipmentCode: normalizeMasterId(systemId, MASTER_ENTITY_CODES.EQPM),
        machinery: mapMachineryFamily(row["Machinery Family"]),
        system: cellStr(row["System / Equipment"]),
        equipmentComponent: cellStr(row["System / Equipment"]),
        department: "Engine",
        vesselType: "All Types",
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedEquipmentMasterRow => row !== null);
}

function parseV38ComponentMaster(rows: Array<Record<string, unknown>>): ParsedComponentMasterRow[] {
  return rows
    .map((row, index) => {
      const componentId = cellStr(row["Component ID"]);
      if (!componentId) return null;
      const systemId = cellStr(row["System ID"]);
      return {
        rowNumber: index + 2,
        componentCode: normalizeMasterId(componentId, MASTER_ENTITY_CODES.COMP),
        equipmentCode: systemId ? normalizeMasterId(systemId, MASTER_ENTITY_CODES.EQPM) : "",
        componentName: cellStr(row["Component"]),
        componentType: cellStr(row["Component Type"]) || "Machinery component",
        activeFlag: true,
        system: cellStr(row["System / Equipment"]),
        owner: null,
      };
    })
    .filter((row): row is ParsedComponentMasterRow => row !== null);
}

function buildV38RepositoryIndex(
  systemRows: Array<Record<string, unknown>>,
  jobs: ParsedMasterJobRow[],
): V3RepositoryIndexRow[] {
  const jobCountBySystem = new Map<string, number>();
  const systemNameById = new Map<string, string>();
  const machineryBySystem = new Map<string, string>();

  for (const row of systemRows) {
    const systemId = cellStr(row["System ID"]);
    if (!systemId) continue;
    systemNameById.set(systemId, cellStr(row["System / Equipment"]));
    machineryBySystem.set(systemId, mapMachineryFamily(row["Machinery Family"]));
    jobCountBySystem.set(systemId, 0);
  }

  for (const job of jobs) {
    const equipmentCode = job.subComponent ?? "";
    const systemId = equipmentCode.replace(/^EQPM-/, "");
    if (!systemId || !jobCountBySystem.has(systemId)) continue;
    jobCountBySystem.set(systemId, (jobCountBySystem.get(systemId) ?? 0) + 1);
  }

  return [...jobCountBySystem.entries()].map(([systemId, jobCount]) => {
    const machinery = machineryBySystem.get(systemId) ?? "Fresh Water Generator";
    return {
      systemCode: systemId.replace(/^V38-/, "V38-"),
      systemName: systemNameById.get(systemId) ?? systemId,
      jobCount,
      status: "Completed",
      machineryFamily: machinery as V3RepositoryIndexRow["machineryFamily"],
    };
  });
}

export function parseV38IncrementalRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV38IncrementalWorkbook(workbook)) {
    throw new Error("Not a V3.8 incremental EMDR repository workbook");
  }

  const jobRows = normalizeV38JobRows(sheetRows(workbook, V38_INCREMENTAL_SHEETS.jobs));
  const masterJobs = parseMasterJobs(jobRows).map((job) => ({
    ...job,
    libraryVersion: EMDR_V38_RELEASE,
  }));

  const templates = synthesizeV3Templates(masterJobs);
  const workflows = synthesizeV3Workflows(templates, masterJobs);
  const scopeSteps = synthesizeV3ScopeSteps(masterJobs);
  const templateIdByJobId = buildTemplateIdByJobId(masterJobs);
  const systemRows = sheetRows(workbook, V38_INCREMENTAL_SHEETS.systems);

  const parsed: ParsedMtilWorkbook = {
    libraryVersion: EMDR_V38_RELEASE,
    masterJobs,
    templates,
    measurements: parseV38Measurements(
      sheetRows(workbook, V38_INCREMENTAL_SHEETS.measurements),
      templateIdByJobId,
    ),
    checklistItems: parseV38Checklist(
      sheetRows(workbook, V38_INCREMENTAL_SHEETS.inspections),
      templateIdByJobId,
    ),
    scopeSteps,
    attachments: [],
    spares: parseV38Spares(sheetRows(workbook, V38_INCREMENTAL_SHEETS.spares), templateIdByJobId),
    rfqMappings: parseV38Rfq(sheetRows(workbook, V38_INCREMENTAL_SHEETS.rfq)),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: parseV38EquipmentMaster(systemRows),
      componentMaster: parseV38ComponentMaster(sheetRows(workbook, V38_INCREMENTAL_SHEETS.components)),
      tools: parseV38Tools(sheetRows(workbook, V38_INCREMENTAL_SHEETS.tools), templateIdByJobId),
    },
    repositoryIndex: buildV38RepositoryIndex(systemRows, normalized.masterJobs),
    release: EMDR_V38_RELEASE,
  };
}

export function parseV38IncrementalRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV38IncrementalRepositoryBuffer(bytes);
}

export function parseV38IncrementalRepositoryIfExists(path: string): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV38IncrementalRepositoryFile(path);
  } catch {
    return null;
  }
}
