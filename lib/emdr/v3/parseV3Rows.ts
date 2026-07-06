import type {
  ParsedChecklistRow,
  ParsedMasterJobRow,
  ParsedMeasurementRow,
  ParsedRfqRow,
  ParsedScopeStepRow,
  ParsedSpareRow,
  ParsedTemplateRow,
  ParsedWorkflowRow,
} from "@/lib/mtil/import/parseWorkbook";
import {
  cellStr,
  mapItemType,
  mapInputType,
  mapPricingBasis,
  mapResponsibleParty,
  mapResponseType,
  mapTemplateCategory,
  mapUiLayout,
  normalizeStatusFlow,
  parseRequiredAttachments,
  parseRequiredPhotos,
  ynBool,
} from "@/lib/mtil/import/excelValues";
import { MASTER_ENTITY_CODES, normalizeMasterId, workflowIdForTemplateId } from "@/lib/mtil/masterCodeStandard";
import { parseChecklist, parseMeasurements } from "@/lib/mtil/v2/import/parseSprintRows";
import type { ParsedComponentMasterRow, ParsedEquipmentMasterRow, ParsedToolMasterRow } from "@/lib/emdr/types";

function mandatoryFlagFromCell(value: unknown): boolean {
  const raw = cellStr(value).toLowerCase();
  if (!raw) return false;
  if (
    raw === "mandatory" ||
    raw.startsWith("y") ||
    raw.startsWith("yes") ||
    raw === "true" ||
    raw === "1"
  ) {
    return true;
  }
  if (raw.startsWith("n") || raw.startsWith("no") || raw === "false" || raw === "0" || raw === "optional") {
    return false;
  }
  return ynBool(value, "Mandatory");
}

/** V3.2 boilers workbook uses a compact inspection tab (Inspection Point / INSP-* IDs). */
export function parseV3Checklist(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedChecklistRow[] {
  if (rows.length === 0) return [];
  const sample = rows[0] ?? {};
  const usesV34Format = Boolean(cellStr(sample["Checklist Point"]));

  if (usesV34Format) {
    const seqByChecklist = new Map<string, number>();
    const parsed: ParsedChecklistRow[] = [];
    for (const [index, row] of rows.entries()) {
      const checklistItemId = cellStr(row["Checklist ID"]);
      const checklistId = cellStr(row["Inspection Set ID"] ?? row["Inspection Checklist ID"]);
      const jobId = cellStr(row["Job ID"]);
      if (!checklistItemId || !checklistId) continue;
      const templateId = templateIdByJobId.get(jobId);
      if (!templateId) continue;
      const seq = (seqByChecklist.get(checklistId) ?? 0) + 1;
      seqByChecklist.set(checklistId, seq);
      parsed.push({
        rowNumber: index + 2,
        checklistItemId,
        checklistId,
        templateId,
        sequenceNo: seq,
        inspectionItem: cellStr(row["Checklist Point"]),
        acceptanceCriteria: cellStr(row["Remarks Requirement"] ?? row["Remarks"]),
        responseType: mapResponseType(row["Result Options"] ?? row["Result Type"]),
        photoRequiredOnFail: false,
        mandatoryFlag: mandatoryFlagFromCell(row["Mandatory Type"] ?? row["Mandatory"]),
        remarks: cellStr(row["Remarks Requirement"] ?? row["Remarks"]) || null,
      });
    }
    return parsed;
  }

  const usesCompactFormat =
    Boolean(cellStr(sample["Inspection Point"])) ||
    (Boolean(cellStr(sample["Checklist ID"])) && !cellStr(sample["Checklist Item ID"]));

  if (!usesCompactFormat) {
    return parseChecklist(rows);
  }

  const seqByChecklist = new Map<string, number>();
  const parsed: ParsedChecklistRow[] = [];

  for (const [index, row] of rows.entries()) {
    const checklistItemId = cellStr(row["Checklist ID"]);
    const checklistId = cellStr(row["Inspection Checklist ID"] ?? row["Checklist ID"]);
    const jobId = cellStr(row["Job ID"]);
    if (!checklistItemId || !checklistId) continue;

    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;

    const seq = (seqByChecklist.get(checklistId) ?? 0) + 1;
    seqByChecklist.set(checklistId, seq);

    parsed.push({
      rowNumber: index + 2,
      checklistItemId,
      checklistId,
      templateId,
      sequenceNo: seq,
      inspectionItem: cellStr(row["Inspection Point"] ?? row["Inspection Item"]),
      acceptanceCriteria: cellStr(row["Acceptance Criteria"] ?? row["Remarks"]),
      responseType: mapResponseType(row["Result Type"] ?? row["Response Type"]),
      photoRequiredOnFail: ynBool(
        row["Photo Required on Fail"] ?? row["Photo Required On Fail"],
        "Photo Required on Fail",
      ),
      mandatoryFlag: mandatoryFlagFromCell(row["Mandatory"] ?? row["Mandatory Flag"]),
      remarks: cellStr(row["Remarks"]) || null,
    });
  }

  return parsed;
}

/** Normalize V3 workbook job rows before shared MTIL parsers run. */
export function isV34JobSheet(rows: Array<Record<string, unknown>>): boolean {
  const sample = rows[0];
  return Boolean(sample && cellStr(sample["Machinery Family"]));
}

function isV34IndexSheet(rows: Array<Record<string, unknown>>): boolean {
  const sample = rows[0];
  return Boolean(sample && cellStr(sample["Machinery Family"]) && cellStr(sample["Library ID"]));
}

function parseV34DurationHours(value: unknown): number | null {
  const raw = cellStr(value);
  if (!raw) return null;
  const parts = raw
    .split("-")
    .map((part) => parseFloat(part.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return (parts[0]! + parts[parts.length - 1]!) / 2;
}

function normalizeV34YnField(value: unknown, defaultValue = "N"): string {
  const raw = cellStr(value);
  if (!raw) return defaultValue;
  const upper = raw.toUpperCase();
  if (upper === "Y" || upper === "N" || upper === "YES" || upper === "NO" || upper === "TRUE" || upper === "FALSE") {
    return upper.startsWith("Y") || upper === "TRUE" ? "Y" : "N";
  }
  const lower = raw.toLowerCase();
  if (/class|owner witness|dry dock item|statutory|maker attendance|recommended|critical|five-yearly/.test(lower)) {
    return "Y";
  }
  return defaultValue;
}

function normalizeV34JobSource(value: unknown): string {
  const raw = cellStr(value);
  if (!raw) return "Special Survey";
  if (raw.includes(";")) {
    return raw
      .split(";")
      .map((part) => {
        const key = part.trim().toLowerCase();
        if (key === "dry dock") return "Special Survey";
        if (key === "pms") return "Occasional Repair";
        if (key === "repair") return "Occasional Repair";
        if (key === "class survey") return "Special Survey";
        return part.trim();
      })
      .join("; ");
  }

  const lower = raw.toLowerCase();
  const types: string[] = [];
  if (/pms|maker manual|running maintenance|repair/.test(lower)) types.push("Occasional Repair");
  if (/dry dock|class survey|class dry dock|ocimf|survey/.test(lower)) types.push("Special Survey");
  return types.length > 0 ? [...new Set(types)].join("; ") : "Special Survey";
}

function normalizeV34JobRow(row: Record<string, unknown>): Record<string, unknown> {
  const workLocation = cellStr(row["Work Location"]) || "Machinery Workshop";
  return {
    ...row,
    Machinery: cellStr(row["Machinery Family"]),
    System: cellStr(row["System Name"]),
    Component: cellStr(row["Component Name"]),
    "Equipment Code": cellStr(row["Equipment ID"]),
    "Standard Job": cellStr(row["Job Heading"]),
    "Detailed Scope": cellStr(row["Job Description"]),
    "Vessel Types": normalizeV3VesselTypes(row["Applicable Vessel Type"] ?? row["Applicable Vessel Types"]),
    "Project Types": normalizeV34JobSource(row["Job Source"]),
    Workshop: workLocation,
    "Responsible Vessel Role": cellStr(row["PIC"]),
    "Review Role": cellStr(row["Verifying Authority"]),
    "Approval Role": cellStr(row["Office Owner"]),
    "Inspection Checklist ID": cellStr(row["Inspection Set ID"]),
    "Scope of Work ID": cellStr(row["Scope ID"]),
    "Required Photos": cellStr(row["Photo Stage"]),
    "Required Attachments": cellStr(row["Attachment Requirements"]),
    "Estimated Manhours": parseV34DurationHours(row["Expected Duration Hours"]),
    "Class Hold Point": normalizeV34YnField(row["Class Hold Point"]),
    "Maker Attendance": normalizeV34YnField(row["Maker Attendance"]),
    Department: cellStr(row["Department"]) || "Engine",
    "Risk Level": cellStr(row["Risk Level"]) || "Medium",
    "Active Flag": row["Active"] ?? "Y",
  };
}

export function normalizeV3JobRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (isV34JobSheet(rows)) {
    return rows.map(normalizeV34JobRow);
  }
  return rows.map((row) => {
    const workshop = cellStr(row["Workshop"]) || "Machinery Workshop";
    return {
      ...row,
      Department: cellStr(row["Department"]) || "Engine",
      Workshop: workshop,
      "Vessel Types": normalizeV3VesselTypes(row["Vessel Types"]),
      "Project Types": normalizeV3ProjectTypes(row["Project Types"]),
      "Risk Level": cellStr(row["Risk Level"]) || "Medium",
      "Active Flag": row["Active"] ?? row["Active Flag"] ?? "Y",
    };
  });
}

function mapSlashSeparatedVesselTypes(raw: string): string {
  const lower = raw.toLowerCase();
  if (/tanker|chemical|product|oil|copt/.test(lower) && !/bulk|container|general|multipurpose|ro-ro|offshore support/.test(lower)) {
    if (/oil tanker|product tanker|chemical tanker/.test(lower)) return "Oil Tanker; Product Tanker; Chemical Tanker";
    return "Tanker";
  }

  const parts = raw.split("/").map((part) => part.trim()).filter(Boolean);
  const names = parts.flatMap((part) => {
    const key = part.toLowerCase();
    if (key.includes("bulk")) return ["Bulk Carrier"];
    if (key.includes("general cargo")) return ["General Cargo"];
    if (key.includes("container")) return ["Container Ship"];
    if (key.includes("multipurpose") || key === "mpp") return ["MPP"];
    if (key.includes("ro-ro") || key.includes("roro")) return ["Ro-Ro"];
    if (key.includes("offshore")) return ["Offshore Support"];
    if (key.includes("oil tanker")) return ["Oil Tanker"];
    if (key.includes("product tanker")) return ["Product Tanker"];
    if (key.includes("chemical tanker")) return ["Chemical Tanker"];
    if (key.includes("special vessel")) return ["All Types"];
    return [part];
  });

  return names.length > 0 ? [...new Set(names)].join("; ") : "All Types";
}

function normalizeV3VesselTypes(value: unknown): string {
  const raw = cellStr(value);
  if (!raw || raw.toLowerCase() === "all" || raw.toLowerCase() === "all vessel types") {
    return "All Types";
  }
  if (raw.includes("/")) {
    return mapSlashSeparatedVesselTypes(raw);
  }
  return raw;
}

function normalizeV3ProjectTypes(value: unknown): string {
  const raw = cellStr(value);
  if (!raw) return "Special Survey";
  return raw
    .split(";")
    .map((part) => {
      const key = part.trim().toLowerCase();
      if (key === "dry dock") return "Special Survey";
      if (key === "running maintenance") return "Occasional Repair";
      if (key === "pms") return "Occasional Repair";
      if (key === "repair") return "Occasional Repair";
      if (key === "class survey") return "Special Survey";
      return part.trim();
    })
    .join("; ");
}

export function parseV3EquipmentMaster(rows: Array<Record<string, unknown>>): ParsedEquipmentMasterRow[] {
  return rows
    .map((row, index) => {
      const rawCode = cellStr(row["Equipment Code"] ?? row["Equipment ID"]);
      if (!rawCode) return null;
      return {
        rowNumber: index + 2,
        equipmentCode: normalizeMasterId(rawCode, MASTER_ENTITY_CODES.EQPM),
        machinery: cellStr(row["Machinery"] ?? row["Machinery Family"]),
        system: cellStr(row["System"] ?? row["System Name"]),
        equipmentComponent: cellStr(row["Equipment Name"] ?? row["Equipment / Component"] ?? row["Description"]),
        department: cellStr(row["Department"]),
        vesselType: cellStr(row["Vessel Types"] ?? row["Vessel Type"]),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedEquipmentMasterRow => row !== null);
}

export function parseV3Measurements(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedMeasurementRow[] {
  if (rows.length === 0) return [];
  const sample = rows[0] ?? {};
  if (!cellStr(sample["Measurement Parameters"])) {
    return parseMeasurements(rows);
  }

  return rows.flatMap((row, index) => {
    const measurementId = cellStr(row["Measurement ID"]);
    const jobId = cellStr(row["Job ID"]);
    if (!measurementId || !jobId) return [];
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) return [];
    return [
      {
        rowNumber: index + 2,
        measurementId,
        measurementSetId: cellStr(row["Measurement Set ID"]),
        templateId,
        measurementName: cellStr(row["Measurement Parameters"]),
        unit: "—",
        minLimit: null,
        maxLimit: null,
        targetValue: cellStr(row["Recording Method"]) || null,
        inputType: mapInputType(row["Recording Method"] ?? row["Input Type"]),
        mandatoryFlag: true,
        remarks: null,
      },
    ];
  });
}

export function parseV3ToolMaster(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedToolMasterRow[] {
  return rows
    .map((row, index) => {
      const toolId = cellStr(row["Tool Mapping ID"] ?? row["Tool ID"] ?? row["Tool Map ID"]);
      const jobId = cellStr(row["Job ID"]);
      if (!toolId || !jobId) return null;
      const templateId = templateIdByJobId.get(jobId);
      if (!templateId) return null;
      const ppe = cellStr(row["PPE Required"] ?? row["PPE"]);
      return {
        rowNumber: index + 2,
        toolId: normalizeMasterId(toolId, MASTER_ENTITY_CODES.TOOL),
        templateId: normalizeMasterId(templateId, MASTER_ENTITY_CODES.TMPL),
        toolName: cellStr(row["Tools / Instruments"] ?? row["Tool / Instrument"] ?? row["Tools Required"]),
        toolType: ppe ? "Tools & PPE" : "Tool",
        mandatory: mandatoryFlagFromCell(row["Mandatory"] ?? row["Calibration Required"] ?? "Y"),
        remarks: cellStr(row["Calibration / Remarks"] ?? row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedToolMasterRow => row !== null);
}

export function parseV3Spares(
  rows: Array<Record<string, unknown>>,
  templateIdByJobId: Map<string, string>,
): ParsedSpareRow[] {
  const parsed: ParsedSpareRow[] = [];
  for (const [index, row] of rows.entries()) {
    const spareMapId = cellStr(row["Spare Mapping ID"] ?? row["Spare Map ID"]);
    const jobId = cellStr(row["Job ID"]);
    if (!spareMapId || !jobId) continue;
    const templateId = templateIdByJobId.get(jobId);
    if (!templateId) continue;

    const genericSpares = cellStr(row["Generic Spares"] ?? row["Generic Item Description"]);
    const consumables = cellStr(row["Consumables"]);
    const itemTypeRaw = cellStr(row["Item Type"]).toLowerCase();

    if (genericSpares) {
      parsed.push({
        rowNumber: index + 2,
        spareMapId: `${spareMapId}-SPAR`,
        jobId,
        templateId,
        itemType: mapItemType(itemTypeRaw.includes("consum") ? "Consumable" : "Spare"),
        itemName: genericSpares,
        quantityBasis: "per_job",
        recommendedQty: null,
        ownerSupplyFlag: false,
        yardSupplyFlag: false,
        remarks: cellStr(row["Remarks"]) || null,
      });
    }
    if (consumables) {
      parsed.push({
        rowNumber: index + 2,
        spareMapId: `${spareMapId}-CONS`,
        jobId,
        templateId,
        itemType: mapItemType("Consumable"),
        itemName: consumables,
        quantityBasis: "per_job",
        recommendedQty: null,
        ownerSupplyFlag: false,
        yardSupplyFlag: false,
        remarks: cellStr(row["Remarks"]) || null,
      });
    }
  }
  return parsed;
}

export function parseV3Rfq(rows: Array<Record<string, unknown>>): ParsedRfqRow[] {
  return rows
    .map((row, index) => {
      const mappingId = cellStr(row["RFQ Mapping ID"] ?? row["Mapping ID"] ?? row["RFQ Map ID"]);
      const jobId = cellStr(row["Job ID"]);
      if (!mappingId || !jobId) return null;
      const rfqSection = cellStr(row["RFQ Category"] ?? row["RFQ Section"]);
      const budgetCategory = cellStr(row["Budget Category"]);
      return {
        rowNumber: index + 2,
        mappingId,
        jobId,
        rfqSection,
        quoteComparisonSection:
          cellStr(row["Job Heading"]) ||
          cellStr(row["Quote Comparison Section"]) ||
          rfqSection ||
          budgetCategory,
        budgetCategory,
        costCode: cellStr(row["Cost Code"] ?? row["Dry Dock Cost Code"]) || budgetCategory,
        workshop: cellStr(row["Workshop"]) || "Machinery Workshop",
        pricingBasis: mapPricingBasis(row["Pricing Basis"]),
        discountApplicable: false,
        netItemFlag: false,
      };
    })
    .filter((row): row is ParsedRfqRow => row !== null);
}

function inferTemplateCategory(standardJobName: string) {
  const key = standardJobName.toLowerCase();
  if (key.includes("inspect") || key.includes("survey")) return mapTemplateCategory("inspection");
  if (key.includes("measure")) return mapTemplateCategory("measurement");
  if (key.includes("overhaul") || key.includes("renew")) return mapTemplateCategory("machinery overhaul");
  if (key.includes("test")) return mapTemplateCategory("testing");
  return mapTemplateCategory("general");
}

/** V3 workbooks define templates implicitly — one template per standard job type per system. */
export function synthesizeV3Templates(masterJobs: ParsedMasterJobRow[]): ParsedTemplateRow[] {
  const byTemplateId = new Map<string, ParsedMasterJobRow>();
  for (const job of masterJobs) {
    if (!byTemplateId.has(job.templateId)) byTemplateId.set(job.templateId, job);
  }

  return [...byTemplateId.entries()].map(([templateId, job], index) => ({
    rowNumber: index + 2,
    templateId,
    templateName: job.standardJobName,
    templateCategory: inferTemplateCategory(job.standardJobName),
    version: job.libraryVersion,
    formSections: [],
    autoFillFields: [],
    manualInputFields: [],
    requiredPhotos: parseRequiredPhotos(job.photoRequired ? "Before;After" : ""),
    requiredAttachments: parseRequiredAttachments(job.attachmentRequired ? "Report" : ""),
    measurementSetId: job.measurementSetId,
    checklistId: job.inspectionChecklistId,
    approvalWorkflowId: workflowIdForTemplateId(templateId),
    uiLayoutType: mapUiLayout("card_tabs"),
    activeFlag: job.activeFlag,
  }));
}

export function synthesizeV3Workflows(
  templates: ParsedTemplateRow[],
  masterJobs: ParsedMasterJobRow[],
): ParsedWorkflowRow[] {
  const jobByTemplate = new Map<string, ParsedMasterJobRow>();
  for (const job of masterJobs) {
    if (!jobByTemplate.has(job.templateId)) jobByTemplate.set(job.templateId, job);
  }

  return templates.map((template, index) => {
    const job = jobByTemplate.get(template.templateId);
    return {
      rowNumber: index + 2,
      workflowId: workflowIdForTemplateId(template.templateId),
      templateId: template.templateId,
      createdByRole: job?.responsibleUserRole || "Chief Engineer",
      reviewByRole: job?.reviewRole || "Chief Engineer",
      approveByRole: job?.approvalRole || "Technical Superintendent",
      shipyardUpdateRole: "Shipyard Planner",
      classApprovalRequired: job?.classHoldPoint ?? false,
      ownerApprovalRequired: false,
      statusFlow: normalizeStatusFlow("Draft → Review → Approved → Closed"),
    };
  });
}

export function synthesizeV3ScopeSteps(masterJobs: ParsedMasterJobRow[]): ParsedScopeStepRow[] {
  return masterJobs.map((job, index) => ({
    rowNumber: index + 2,
    scopeStepId: `${job.scopeOfWorkId ?? job.templateId.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.SCOP}-`)}-01`,
    scopeOfWorkId:
      job.scopeOfWorkId ??
      job.templateId.replace(new RegExp(`^${MASTER_ENTITY_CODES.TMPL}-`), `${MASTER_ENTITY_CODES.SCOP}-`),
    templateId: job.templateId,
    sequenceNo: 1,
    workStep: job.jobDescription || job.standardJobName,
    responsibleParty: mapResponsibleParty(
      /engineer|vessel|crew/i.test(job.responsibleUserRole) ? "Vessel" : job.responsibleUserRole || "Vessel",
    ),
    permitRequired: null,
    qaHoldPoint: false,
    classHoldPoint: job.classHoldPoint,
  }));
}

export function buildTemplateIdByJobId(masterJobs: ParsedMasterJobRow[]): Map<string, string> {
  return new Map(masterJobs.map((job) => [job.jobId, job.templateId]));
}

export function parseV3LibraryVersion(rows: Array<Record<string, unknown>>): string {
  for (const row of rows) {
    const release = cellStr(row["Release"]);
    if (release.startsWith("V3")) return release;
  }
  return "V3.0-ME-100";
}

export type V3RepositoryIndexRow = {
  systemCode: string;
  systemName: string;
  jobCount: number;
  status: string;
  machineryFamily?:
    | "Main Engine"
    | "Auxiliary Engine"
    | "Boilers"
    | "Pumps"
    | "Compressors"
    | "Purifiers"
    | "Heat Exchangers, Heaters & Condensers"
    | "Cargo Oil Pump Turbine System"
    | "Deck Heating, Cargo Tank Heating & Steam Coils"
    | "Deck Masts, Wires & Standing Rigging"
    | "Deck & Engine Room Lifting Appliances"
    | "Cargo Pumping System"
    | "Steering Gear System"
    | "Fresh Water Generator"
    | "Air Conditioning & Ventilation"
    | "Refrigeration Plant"
    | "Deck Machinery – Windlass / Winches / Capstans"
    | "Life Saving Appliances / Davits / Rescue Boat Davit"
    | "Fire Fighting Systems"
    | "Inert Gas / IGG / Scrubber System"
    | "Compressed Air & Starting Air System";
};

export function parseV3UnifiedRepositoryIndex(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  return rows.flatMap((row) => {
    const machineryFamily = cellStr(row["Machinery Family"]);
    const systemCode = cellStr(row["System Code"]);
    const systemName = cellStr(row["System Name"]);
    if (!machineryFamily || !systemCode || !systemName) return [];
    const jobCount = Number(row["Job Count"]) || 0;
    if (jobCount <= 0) return [];
    const familyMap: Record<string, NonNullable<V3RepositoryIndexRow["machineryFamily"]>> = {
      "Main Engine": "Main Engine",
      "Auxiliary Engine": "Auxiliary Engine",
      Boilers: "Boilers",
      Pumps: "Pumps",
      Compressors: "Compressors",
      Purifiers: "Purifiers",
      "Heat Exchangers, Heaters & Condensers": "Heat Exchangers, Heaters & Condensers",
      "Cargo Oil Pump Turbine System": "Cargo Oil Pump Turbine System",
      "Deck Heating, Cargo Tank Heating & Steam Coils": "Deck Heating, Cargo Tank Heating & Steam Coils",
      "Deck Masts, Wires & Standing Rigging": "Deck Masts, Wires & Standing Rigging",
      "Deck & Engine Room Lifting Appliances": "Deck & Engine Room Lifting Appliances",
      "Cargo Pumping System": "Cargo Pumping System",
      "Steering Gear System": "Steering Gear System",
      "Fresh Water Generator": "Fresh Water Generator",
      "Air Conditioning & Ventilation": "Air Conditioning & Ventilation",
      "Air Conditioning System": "Air Conditioning & Ventilation",
      "Refrigeration Plant": "Refrigeration Plant",
      "Refrigeration System": "Refrigeration Plant",
    };
    const mapped = familyMap[machineryFamily];
    if (!mapped) return [];
    return [
      {
        systemCode,
        systemName,
        jobCount,
        status: cellStr(row["Status"]) || "Completed",
        machineryFamily: mapped,
      },
    ];
  });
}

export function buildV3RepositoryIndex(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  if (isV34IndexSheet(rows)) {
    return parseV3UnifiedRepositoryIndex(rows);
  }
  return [
    ...parseV3RepositoryIndex(rows),
    ...parseV3BoilerRepositoryIndex(rows),
    ...parseV3PumpRepositoryIndex(rows),
  ];
}

export function parseV3RepositoryIndex(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  return rows.flatMap((row) => {
    const systemCode = cellStr(row["System Code"]);
    const systemName = cellStr(row["System Name"] ?? row["Family"]);
    if (!systemCode || !systemName) return [];
    if (["AE", "BLR", "PMP", "CMP", "PUR", "Boilers", "Auxiliary Engine"].includes(systemCode)) {
      return [];
    }
    if (systemCode.startsWith("ME-M") || systemCode.startsWith("AE-A")) return [];
    const jobCount = Number(row["Job Count"]) || 0;
    if (jobCount <= 0) return [];
    return [
      {
        systemCode,
        systemName,
        jobCount,
        status: cellStr(row["Status"]) || "Completed",
        machineryFamily: "Main Engine" as const,
      },
    ];
  });
}

export function parseV3BoilerRepositoryIndex(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  return rows.flatMap((row) => {
    const systemCode = cellStr(row["System Code"]);
    const systemName = cellStr(row["System Name"] ?? row["Family"]);
    if (!systemCode.startsWith("BLR-") || !systemName) return [];
    const jobCount = Number(row["Job Count"]) || 0;
    if (jobCount <= 0) return [];
    return [
      {
        systemCode,
        systemName,
        jobCount,
        status: cellStr(row["Status"]) || "Completed",
        machineryFamily: "Boilers" as const,
      },
    ];
  });
}

export function parseV3PumpRepositoryIndex(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  return rows.flatMap((row) => {
    const systemCode = cellStr(row["System Code"]);
    const systemName = cellStr(row["System Name"] ?? row["Family"]);
    if (!systemCode.startsWith("PMP-") || !systemName) return [];
    const jobCount = Number(row["Job Count"]) || 0;
    if (jobCount <= 0) return [];
    return [
      {
        systemCode,
        systemName,
        jobCount,
        status: cellStr(row["Status"]) || "Completed",
        machineryFamily: "Pumps" as const,
      },
    ];
  });
}

export function parseV3AeSummary(rows: Array<Record<string, unknown>>): V3RepositoryIndexRow[] {
  const parsed: V3RepositoryIndexRow[] = [];
  for (const row of rows) {
    const code = cellStr(row["Auxiliary Engine Repository Summary - V3.1"]);
    const systemName = cellStr(row["__EMPTY"]);
    const jobCount = Number(row["__EMPTY_2"]);
    if (!code || !systemName || !Number.isFinite(jobCount) || jobCount <= 0) continue;
    if (code === "System Code" || code === "Equipment Systems") continue;
    if (!/^[A-Z]{2,4}$/.test(code)) continue;
    parsed.push({
      systemCode: `AE-${code}`,
      systemName,
      jobCount,
      status: "Completed",
      machineryFamily: "Auxiliary Engine",
    });
  }
  return parsed;
}
