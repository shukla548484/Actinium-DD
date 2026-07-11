import fs from "node:fs";
import * as XLSX from "xlsx";
import { cellStr, ynBool } from "@/lib/mtil/import/excelValues";
import {
  V41_BUDGET_CATEGORIES,
  V41_VALIDATION_STATUSES,
  type V41BudgetCategory,
  type V41ValidationStatus,
} from "@/lib/emdr/v4/constants";

export const V41_UPLOAD_SHEETS = {
  pms: "PMS_Upload_Ready",
  dryDockRfq: "DryDock_RFQ_Ready",
  budget: "Budget_Cost_Code_Mapping",
  vesselTypeFilter: "Vessel_Type_Filter",
  duplicateControl: "Duplicate_Control",
  validationErrors: "Validation_Errors",
  importLookups: "Import_Lookups",
  exportSummary: "Export_Summary",
} as const;

export type V41PmsUploadRow = {
  rowNumber: number;
  canonicalJobId: string;
  machinery: string;
  component: string;
  jobHeading: string;
  jobDescription: string;
  frequencyType: string;
  frequencyInterval: string;
  jobType: string;
  responsibleRankPic: string;
  verifyingAuthority: string;
  vesselTypeApplicability: string;
  criticality: string;
  sourceModule: string;
  duplicateGroupId: string | null;
  validationStatus: V41ValidationStatus;
  activeFlag: boolean;
};

export type V41DryDockRfqRow = {
  rowNumber: number;
  canonicalJobId: string;
  rfqGroup: string;
  machinerySystem: string;
  jobScope: string;
  uom: string;
  quantityBasis: string;
  yardOwnerMakerResponsibility: string;
  inspectionRequirement: string;
  testRequirement: string;
  classAttendance: string;
  remarks: string;
};

export type V41BudgetMappingRow = {
  rowNumber: number;
  canonicalJobId: string;
  budgetCategory: V41BudgetCategory;
  costCode: string;
  rfqSection: string;
  quoteComparisonSection: string;
};

export type V41ParsedUploadWorkbook = {
  filePath: string;
  exportVersion: string | null;
  pmsRows: V41PmsUploadRow[];
  dryDockRfqRows: V41DryDockRfqRow[];
  budgetRows: V41BudgetMappingRow[];
  sheetRowCounts: Record<string, number>;
};

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function parseValidationStatus(value: unknown, rowNumber: number, sheet: string): V41ValidationStatus {
  const raw = cellStr(value);
  if ((V41_VALIDATION_STATUSES as readonly string[]).includes(raw)) {
    return raw as V41ValidationStatus;
  }
  throw new Error(`${sheet} row ${rowNumber}: invalid Validation_Status "${raw}"`);
}

function parseBudgetCategory(value: unknown, rowNumber: number): V41BudgetCategory {
  const raw = cellStr(value);
  if ((V41_BUDGET_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as V41BudgetCategory;
  }
  throw new Error(`Budget_Cost_Code_Mapping row ${rowNumber}: invalid Budget_Category "${raw}"`);
}

function parsePmsRows(rows: Array<Record<string, unknown>>): V41PmsUploadRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const canonicalJobId = cellStr(row.Canonical_Job_ID);
    if (!canonicalJobId) {
      throw new Error(`PMS_Upload_Ready row ${rowNumber}: Canonical_Job_ID is required`);
    }

    const frequencyType = cellStr(row.Frequency_Type);

    return {
      rowNumber,
      canonicalJobId,
      machinery: cellStr(row.Machinery),
      component: cellStr(row.Component),
      jobHeading: cellStr(row.Job_Heading),
      jobDescription: cellStr(row.Job_Description),
      frequencyType,
      frequencyInterval: cellStr(row.Frequency_Interval),
      jobType: cellStr(row.Job_Type),
      responsibleRankPic: cellStr(row.Responsible_Rank_PIC),
      verifyingAuthority: cellStr(row.Verifying_Authority),
      vesselTypeApplicability: cellStr(row.Vessel_Type_Applicability),
      criticality: cellStr(row.Criticality),
      sourceModule: cellStr(row.Source_Module),
      duplicateGroupId: cellStr(row.Duplicate_Group_ID) || null,
      validationStatus: parseValidationStatus(row.Validation_Status, rowNumber, "PMS_Upload_Ready"),
      activeFlag: ynBool(row.Active_Flag, "Active_Flag"),
    };
  });
}

function parseDryDockRfqRows(rows: Array<Record<string, unknown>>): V41DryDockRfqRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const canonicalJobId = cellStr(row.Canonical_Job_ID);
    if (!canonicalJobId) {
      throw new Error(`DryDock_RFQ_Ready row ${rowNumber}: Canonical_Job_ID is required`);
    }

    return {
      rowNumber,
      canonicalJobId,
      rfqGroup: cellStr(row.RFQ_Group),
      machinerySystem: cellStr(row.Machinery_System),
      jobScope: cellStr(row.Job_Scope),
      uom: cellStr(row.UOM),
      quantityBasis: cellStr(row.Quantity_Basis),
      yardOwnerMakerResponsibility: cellStr(row.Yard_Owner_Maker_Responsibility),
      inspectionRequirement: cellStr(row.Inspection_Requirement),
      testRequirement: cellStr(row.Test_Requirement),
      classAttendance: cellStr(row.Class_Attendance),
      remarks: cellStr(row.Remarks),
    };
  });
}

function parseBudgetRows(rows: Array<Record<string, unknown>>): V41BudgetMappingRow[] {
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const canonicalJobId = cellStr(row.Canonical_Job_ID);
    if (!canonicalJobId) {
      throw new Error(`Budget_Cost_Code_Mapping row ${rowNumber}: Canonical_Job_ID is required`);
    }

    const costCode = cellStr(row.Cost_Code);
    if (!costCode) {
      throw new Error(`Budget_Cost_Code_Mapping row ${rowNumber}: Cost_Code is required`);
    }

    return {
      rowNumber,
      canonicalJobId,
      budgetCategory: parseBudgetCategory(row.Budget_Category, rowNumber),
      costCode,
      rfqSection: cellStr(row.RFQ_Section),
      quoteComparisonSection: cellStr(row.Quote_Comparison_Section) || cellStr(row.RFQ_Section),
    };
  });
}

function parseExportVersion(workbook: XLSX.WorkBook): string | null {
  for (const row of sheetRows(workbook, V41_UPLOAD_SHEETS.exportSummary)) {
    if (cellStr(row.Metric) === "Export Version") {
      return cellStr(row.Value) || null;
    }
  }
  return null;
}

export function parseV41UploadReadyBuffer(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  filePath = "<buffer>",
): V41ParsedUploadWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const pmsRaw = sheetRows(workbook, V41_UPLOAD_SHEETS.pms);
  const rfqRaw = sheetRows(workbook, V41_UPLOAD_SHEETS.dryDockRfq);
  const budgetRaw = sheetRows(workbook, V41_UPLOAD_SHEETS.budget);

  const sheetRowCounts: Record<string, number> = {};
  for (const name of workbook.SheetNames) {
    sheetRowCounts[name] = sheetRows(workbook, name).length;
  }

  return {
    filePath,
    exportVersion: parseExportVersion(workbook),
    pmsRows: parsePmsRows(pmsRaw),
    dryDockRfqRows: parseDryDockRfqRows(rfqRaw),
    budgetRows: parseBudgetRows(budgetRaw),
    sheetRowCounts,
  };
}

export function parseV41UploadReadyFile(filePath: string): V41ParsedUploadWorkbook {
  const buffer = fs.readFileSync(filePath);
  return parseV41UploadReadyBuffer(buffer, filePath);
}
