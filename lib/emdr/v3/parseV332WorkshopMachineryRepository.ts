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
  "Job_Repository",
  "PMS_Repository",
  "Job_List",
  "PMS_Jobs",
  "Workshop_Jobs",
] as const;

export const V332_WMTP_MACHINERY_FAMILY =
  "Workshop Machinery / Engine-Room Tools / Portable Equipment";

const WMTP_JOB_CODE_PATTERN = /^WMTP-\d+$/i;

export function isV332TypewiseWmtpJobId(jobId: string): boolean {
  return /^JOBS-WMTP-\d+$/i.test(jobId);
}

function resolveMasterSheetName(workbook: XLSX.WorkBook): string | null {
  for (const name of MASTER_SHEET_CANDIDATES) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  return (
    workbook.SheetNames.find((name) =>
      /workshop|portable equipment|engine.?room tools/i.test(name),
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

export function isV332WorkshopMachineryWorkbook(workbook: XLSX.WorkBook): boolean {
  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) return false;
  const rows = sheetRows(workbook, sheetName);
  return rows.some((row) => {
    const jobCode = cellStr(row["Job Code"]);
    const machineryGroup = cellStr(row["Machinery Group"]);
    const equipmentSystem = cellStr(row["Equipment/System"] ?? row["Equipment / System"]);
    return (
      /^V3\.32-/i.test(jobCode) ||
      /workshop machinery|engine-room tools|portable equipment/i.test(machineryGroup) ||
      /engine room workshop|workshop safety|calibration|portable lifting/i.test(equipmentSystem)
    );
  });
}

export function normalizeV332WmtpJobCode(raw: string): string {
  const code = cellStr(raw).replace(/^JOBS-/, "");
  if (WMTP_JOB_CODE_PATTERN.test(code)) return `JOBS-${code.toUpperCase()}`;
  const v332Prefixed = /^V3\.32-WMTP-(\d+)$/i.exec(code);
  if (v332Prefixed) return `JOBS-WMTP-${v332Prefixed[1].padStart(4, "0")}`;
  const v332Plain = /^V3\.32-(\d+)$/i.exec(code);
  if (v332Plain) return `JOBS-WMTP-${v332Plain[1].padStart(4, "0")}`;
  return "";
}

function formatWmtpJobCode(sequence: number): string {
  return `JOBS-WMTP-${String(sequence).padStart(4, "0")}`;
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
  return `WMTP-${base}`;
}

function dryDockFlag(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw || raw === "no" || raw === "n" || raw === "pms") return false;
  return raw.startsWith("y") || raw.includes("dry dock") || raw.includes("dry-dock");
}

function riskLevelFromRow(row: Record<string, unknown>): string {
  const criticality = cellStr(row["Risk / Criticality"] ?? row["Criticality"]);
  if (/^(low|medium|high|critical)$/i.test(criticality)) return criticality;
  const dryDock = cellStr(row["Dry Dock / PMS"] ?? row["Dry-Dock / PMS"]);
  if (/dry dock/i.test(dryDock)) return "High";
  return "Medium";
}

function standardJobFromRow(row: Record<string, unknown>): string {
  const heading = cellStr(row["Job Heading"]);
  const asset = cellStr(row["Asset / Component"] ?? row["Asset / Equipment"] ?? row["Equipment / Asset"]);
  const component = cellStr(row["Component"]);
  if (heading && asset) return `${asset} — ${heading}`;
  if (heading && component) return `${component} — ${heading}`;
  return heading || asset || component;
}

function detailedScopeFromRow(row: Record<string, unknown>): string {
  const desc = cellStr(row["Job Description"] ?? row["Job Description / Scope"]);
  const heading = cellStr(row["Job Heading"]);
  const shipyard = cellStr(row["Shipyard Scope"]);
  if (desc && desc.length >= 12) {
    return shipyard ? `${desc}\n\nShipyard scope: ${shipyard}` : desc;
  }
  return heading || desc || shipyard;
}

function picFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank"]);
  if (!pic) return "Second Engineer";
  const lower = pic.toLowerCase();
  if (/\beto\b/.test(lower) || lower.includes("electrical officer") || lower.includes("electrician")) {
    return "Electrical Officer";
  }
  if (lower.includes("chief officer")) return "Chief Officer";
  if (lower.includes("third officer") || lower.includes("deck officer")) return "Chief Officer";
  if (lower.includes("bosun")) return "Chief Officer";
  if (lower.includes("safety officer")) return "Safety Officer";
  if (lower.includes("master")) return "Master";
  if (lower.includes("chief engineer")) return "Chief Engineer";
  if (lower.includes("fourth engineer") || lower.includes("duty engineer")) return "Fourth Engineer";
  if (lower.includes("second engineer") || lower.includes("responsible engineer")) return "Second Engineer";
  if (lower.includes("shipyard")) return "Chief Engineer";
  const primary = pic.split("/")[0]?.trim();
  return primary || pic;
}

function departmentFromRow(row: Record<string, unknown>): string {
  const pic = cellStr(row["PIC"] ?? row["Responsible Rank"]).toLowerCase();
  const system = cellStr(row["Equipment/System"] ?? row["Equipment / System"]).toLowerCase();
  if (/\beto\b/.test(pic) || pic.includes("electrical officer") || pic.includes("electrician")) {
    return "Electrical";
  }
  if (
    pic.includes("chief officer") ||
    pic.includes("third officer") ||
    pic.includes("deck officer") ||
    pic.includes("bosun")
  ) {
    return "Deck";
  }
  if (pic.includes("safety officer") || /workshop safety|lifting gear/i.test(system)) {
    return "Safety";
  }
  return "Engine";
}

function systemNameFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["Equipment/System"] ?? row["Equipment / System"] ?? row["System / Machinery"] ?? row["System"]);
  if (system) return system;
  const section = cellStr(row["Section"] ?? row["Machinery Group"]);
  if (section) return section;
  const asset = cellStr(row["Asset / Component"] ?? row["Asset / Equipment"]);
  return asset || V332_WMTP_MACHINERY_FAMILY;
}

function componentFromRow(row: Record<string, unknown>): string {
  const component = cellStr(row["Component"] ?? row["Asset / Component"]);
  if (component) {
    const equipmentType = cellStr(row["Equipment Type"]);
    if (equipmentType && !component.includes(equipmentType)) {
      return `${component} (${equipmentType})`;
    }
    return component;
  }
  const asset = cellStr(row["Asset / Equipment"] ?? row["Equipment / Asset"]);
  return asset || "Workshop Equipment";
}

function workshopFromRow(row: Record<string, unknown>): string {
  const system = cellStr(row["Equipment/System"] ?? row["Equipment / System"]).toLowerCase();
  const asset = cellStr(row["Asset / Component"] ?? row["Asset / Equipment"]).toLowerCase();
  const combined = `${system} ${asset}`;
  if (/electrical|welding transformer|megger|multimeter|portable lighting/i.test(combined)) {
    return "electrical workshop";
  }
  if (/workshop safety|lifting gear|chain block|shackle|sling|hoist/i.test(combined)) {
    return "safety workshop";
  }
  if (/calibration|torque|utm|pressure calibrator|measuring/i.test(combined)) {
    return "machinery workshop";
  }
  if (/hot.?work|welding|gas cutting|plasma|fume extractor/i.test(combined)) {
    return "machinery workshop";
  }
  if (/portable pump|ventilation|blower/i.test(combined)) return "engine room / hvac ventilation";
  return "machinery workshop";
}

function componentTypeFromSystem(systemName: string, component: string): string {
  const combined = `${systemName} ${component}`.toLowerCase();
  if (/lathe|drill|grinder|cutting|saw|press|threading/i.test(combined)) return "Workshop Machine";
  if (/welding|gas cutting|plasma|fume/i.test(combined)) return "Hot-Work Equipment";
  if (/lifting|chain block|hoist|sling|shackle/i.test(combined)) return "Portable Lifting Gear";
  if (/calibration|torque|utm|megger|multimeter|measuring/i.test(combined)) return "Calibration Instrument";
  if (/portable pump|ventilation|blower|lighting/i.test(combined)) return "Portable Utility Equipment";
  if (/pneumatic|hydraulic tool/i.test(combined)) return "Pneumatic / Hydraulic Tool";
  if (/safety|compliance/i.test(combined)) return "Workshop Safety";
  return "Workshop Equipment";
}

function normalizeV332WmtpJobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const systemCodes = new Map<string, string>();
  let systemIndex = 0;
  let sequence = 0;
  const seenJobIds = new Set<string>();

  return rows.flatMap((row) => {
    const heading = cellStr(row["Job Heading"]);
    if (!heading) return [];

    const explicitCode = normalizeV332WmtpJobCode(cellStr(row["Job Code"]));
    sequence += 1;
    let jobId = explicitCode || formatWmtpJobCode(sequence);
    if (seenJobIds.has(jobId)) {
      sequence += 1;
      jobId = formatWmtpJobCode(sequence);
    }
    seenJobIds.add(jobId);

    const systemName = systemNameFromRow(row);
    let systemCode = systemCodes.get(systemName);
    if (!systemCode) {
      systemCode = systemCodeForSystemName(systemName, systemIndex++);
      systemCodes.set(systemName, systemCode);
    }
    const ids = idsFromJobId(jobId);
    const dryDock = dryDockFlag(row["Dry Dock / PMS"] ?? row["Dry-Dock / PMS"] ?? row["Dry Dock Job"]);
    const asset = cellStr(row["Asset / Component"] ?? row["Asset / Equipment"] ?? row["Equipment / Asset"]);
    const sourceCode = cellStr(row["Job Code"]);
    const crossRef = cellStr(row["Duplicate Control / Cross Reference"]);
    const rfqNote = cellStr(row["RFQ Cost Category"] ?? row["RFQ / Yard Scope Note"]);
    return [
      {
        "Job ID": jobId,
        Release: EMDR_V312_RELEASE,
        Department: departmentFromRow(row),
        Machinery: V332_WMTP_MACHINERY_FAMILY,
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
        "RFQ Category": cellStr(row["RFQ Cost Category"]) || V332_WMTP_MACHINERY_FAMILY,
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

function synthesizeV332WmtpMeasurements(masterJobs: ParsedMasterJobRow[]): ParsedMeasurementRow[] {
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

function synthesizeV332WmtpChecklist(masterJobs: ParsedMasterJobRow[]): ParsedChecklistRow[] {
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

function synthesizeV332WmtpRfq(masterJobs: ParsedMasterJobRow[]): ParsedRfqRow[] {
  return masterJobs.map((job) => {
    const budgetCategory = job.budgetCategory || V332_WMTP_MACHINERY_FAMILY;
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

function synthesizeV332WmtpEquipmentMaster(jobs: ParsedMasterJobRow[]): ParsedEquipmentMasterRow[] {
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

function synthesizeV332WmtpComponentMaster(jobs: ParsedMasterJobRow[]): ParsedComponentMasterRow[] {
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

function buildV332WmtpRepositoryIndex(jobs: ParsedMasterJobRow[]): V3RepositoryIndexRow[] {
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
    machineryFamily: V332_WMTP_MACHINERY_FAMILY as V3RepositoryIndexRow["machineryFamily"],
  }));
}

export function parseV332WorkshopMachineryRepositoryBuffer(
  buffer: ArrayBuffer | Uint8Array,
): ParsedV3MasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!isV332WorkshopMachineryWorkbook(workbook)) {
    throw new Error(
      "Not a V3.32 Workshop Machinery / Engine-Room Tools / Portable Equipment EMDR repository workbook",
    );
  }

  const sheetName = resolveMasterSheetName(workbook);
  if (!sheetName) {
    throw new Error("V3.32 Workshop Machinery workbook is missing a recognizable jobs sheet");
  }

  const jobRows = normalizeV332WmtpJobRows(sheetRows(workbook, sheetName));
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
    measurements: synthesizeV332WmtpMeasurements(masterJobs),
    checklistItems: synthesizeV332WmtpChecklist(masterJobs),
    scopeSteps,
    attachments: [],
    spares: [],
    rfqMappings: synthesizeV332WmtpRfq(masterJobs),
    workflows,
  };

  const normalized = normalizeWorkbookMasterIds(parsed);

  return {
    ...normalized,
    emdrMasterData: {
      equipmentMaster: synthesizeV332WmtpEquipmentMaster(normalized.masterJobs),
      componentMaster: synthesizeV332WmtpComponentMaster(normalized.masterJobs),
      tools: [],
    },
    repositoryIndex: buildV332WmtpRepositoryIndex(normalized.masterJobs),
    release: EMDR_V312_RELEASE,
  };
}

export function parseV332WorkshopMachineryRepositoryFile(path: string): ParsedV3MasterRepository {
  const bytes = fs.readFileSync(path);
  return parseV332WorkshopMachineryRepositoryBuffer(bytes);
}

export function parseV332WorkshopMachineryRepositoryIfExists(
  path: string,
): ParsedV3MasterRepository | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseV332WorkshopMachineryRepositoryFile(path);
  } catch {
    return null;
  }
}
