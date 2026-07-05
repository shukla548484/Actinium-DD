import * as XLSX from "xlsx";
import fs from "node:fs";
import type { ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { cellStr } from "@/lib/mtil/import/excelValues";
import { normalizeWorkbookMasterIds } from "@/lib/mtil/import/normalizeWorkbookMasterIds";
import type { ParsedEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import {
  parseComponentMaster,
  parseEquipmentMaster,
  parseToolMaster,
} from "@/lib/emdr/parseSprintMasterSheets";
import {
  parseChecklist,
  parseMasterJobs,
  parseMeasurements,
  parseRfq,
  parseScope,
  parseSpares,
  parseTemplates,
  parseWorkflows,
} from "@/lib/mtil/v2/import/parseSprintRows";
import { V2_SPRINT_SHEETS } from "@/lib/mtil/v2/import/sprintSheets";

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function parseLibraryVersionFromDashboard(workbook: XLSX.WorkBook): string | null {
  const rows = sheetRows(workbook, "00_Release_Dashboard");
  for (const row of rows) {
    const metric = cellStr(row["Metric"]).toLowerCase();
    if (metric === "library version" || metric === "release") {
      const version = cellStr(row["Value"]);
      if (version) return version;
    }
  }
  return null;
}

/** Align scope step IDs with job SOW IDs (workbook uses WF-* on scope tab). */
export function normalizeSprintScopeSteps(data: ParsedMtilWorkbook): ParsedMtilWorkbook {
  const sowByTemplate = new Map<string, string>();
  for (const job of data.masterJobs) {
    if (job.templateId && job.scopeOfWorkId) {
      sowByTemplate.set(job.templateId, job.scopeOfWorkId);
    }
  }
  const scopeSteps = data.scopeSteps.map((step) => ({
    ...step,
    scopeOfWorkId: sowByTemplate.get(step.templateId) ?? step.scopeOfWorkId,
  }));
  return { ...data, scopeSteps };
}

export function parseV2SprintWorkbookBuffer(buffer: ArrayBuffer | Uint8Array): ParsedEmdrSprintWorkbook {
  const workbook = XLSX.read(buffer, { type: "array" });
  const masterJobs = parseMasterJobs(sheetRows(workbook, V2_SPRINT_SHEETS.jobs));
  const libraryVersion =
    masterJobs[0]?.libraryVersion ?? parseLibraryVersionFromDashboard(workbook) ?? "V2.0.1";

  const parsed: ParsedMtilWorkbook = {
    libraryVersion,
    masterJobs,
    templates: parseTemplates(sheetRows(workbook, V2_SPRINT_SHEETS.templates)),
    measurements: parseMeasurements(sheetRows(workbook, V2_SPRINT_SHEETS.measurements)),
    checklistItems: parseChecklist(sheetRows(workbook, V2_SPRINT_SHEETS.checklist)),
    scopeSteps: parseScope(sheetRows(workbook, V2_SPRINT_SHEETS.scope)),
    attachments: [],
    spares: parseSpares(sheetRows(workbook, V2_SPRINT_SHEETS.spares)),
    rfqMappings: parseRfq(sheetRows(workbook, V2_SPRINT_SHEETS.rfq)),
    workflows: parseWorkflows(sheetRows(workbook, V2_SPRINT_SHEETS.workflows)),
  };

  const normalized = normalizeSprintScopeSteps(normalizeWorkbookMasterIds(parsed));

  const emdrMasterData = {
    equipmentMaster: parseEquipmentMaster(sheetRows(workbook, "01_Equipment_Master")),
    componentMaster: parseComponentMaster(sheetRows(workbook, "02_Component_Master")),
    tools: parseToolMaster(sheetRows(workbook, "08_Tools_Instruments")),
  };

  return { ...normalized, emdrMasterData };
}

export function parseV2SprintWorkbookFile(path: string): ParsedEmdrSprintWorkbook {
  const workbook = XLSX.readFile(path);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return parseV2SprintWorkbookBuffer(bytes);
}

export function parseV2SprintWorkbookFileIfExists(path: string): ParsedEmdrSprintWorkbook {
  const empty: ParsedEmdrSprintWorkbook = {
    libraryVersion: null,
    masterJobs: [],
    templates: [],
    measurements: [],
    checklistItems: [],
    scopeSteps: [],
    attachments: [],
    spares: [],
    rfqMappings: [],
    workflows: [],
    emdrMasterData: { equipmentMaster: [], componentMaster: [], tools: [] },
  };
  if (!fs.existsSync(path)) return empty;
  try {
    return parseV2SprintWorkbookFile(path);
  } catch {
    return empty;
  }
}
