import * as XLSX from "xlsx";
import type {
  DdRiskLevel,
  DryDockProjectType,
  JobAttachmentStage,
  JobAttachmentType,
  JobCatalogDepartment,
  JobCatalogWorkshop,
  JobChecklistResponseType,
  JobMeasurementInputType,
  JobPricingBasis,
  JobQuantityBasis,
  JobScopeResponsibleParty,
  JobSpareItemType,
  JobTemplateCategory,
  JobUiLayoutType,
} from "@prisma/client";
import type {
  JobAutoFillFieldDef,
  JobFormSectionDef,
  JobManualInputFieldDef,
  JobRequiredAttachmentDef,
  JobRequiredPhotoDef,
} from "@/lib/jobCatalog/types";
import {
  cellStr,
  mapAttachmentStage,
  mapAttachmentType,
  mapDepartment,
  mapInputType,
  mapItemType,
  mapPricingBasis,
  mapProjectTypes,
  mapQuantityBasis,
  mapResponsibleParty,
  mapResponseType,
  mapRiskLevel,
  mapTemplateCategory,
  mapUiLayout,
  mapVesselTypes,
  mapWorkshop,
  normalizeStatusFlow,
  parseAutoFillFields,
  parseFormSections,
  parseManualInputFields,
  parseOptionalFloat,
  parsePermitList,
  parseRequiredAttachments,
  parseRequiredPhotos,
  ynBool,
} from "@/lib/mtil/import/excelValues";

export const MTIL_WORKBOOK_SHEETS = {
  masterJobs: "01_Master_Job_Library",
  templates: "02_Dynamic_Templates",
  measurements: "03_Measurements",
  checklist: "04_Inspection_Checklist",
  scope: "05_Scope_of_Work",
  attachments: "06_Attachments_Photos",
  spares: "07_Spares_Materials",
  rfq: "08_RFQ_Budget_Mapping",
  workflows: "09_Workflows",
} as const;

export type ParsedMasterJobRow = {
  rowNumber: number;
  jobId: string;
  libraryVersion: string;
  department: JobCatalogDepartment;
  systemGroup: string;
  machinery: string;
  component: string;
  subComponent: string | null;
  standardJobName: string;
  jobDescription: string;
  applicableVesselTypes: string[];
  applicableProjectTypes: DryDockProjectType[];
  surveyType: string | null;
  workshop: JobCatalogWorkshop;
  responsibleUserRole: string;
  reviewRole: string;
  approvalRole: string;
  templateId: string;
  measurementSetId: string | null;
  inspectionChecklistId: string | null;
  scopeOfWorkId: string | null;
  rfqCategory: string;
  budgetCategory: string;
  dryDockCostCode: string;
  mandatoryFlag: boolean;
  classHoldPoint: boolean;
  makerAttendanceRequired: boolean;
  permitRequired: string[];
  photoRequired: boolean;
  attachmentRequired: boolean;
  standardManHours: number | null;
  riskLevel: DdRiskLevel;
  activeFlag: boolean;
  remarks: string | null;
};

export type ParsedTemplateRow = {
  rowNumber: number;
  templateId: string;
  templateName: string;
  templateCategory: JobTemplateCategory;
  version: string;
  formSections: JobFormSectionDef[];
  autoFillFields: JobAutoFillFieldDef[];
  manualInputFields: JobManualInputFieldDef[];
  requiredPhotos: JobRequiredPhotoDef[];
  requiredAttachments: JobRequiredAttachmentDef[];
  measurementSetId: string | null;
  checklistId: string | null;
  approvalWorkflowId: string;
  uiLayoutType: JobUiLayoutType;
  activeFlag: boolean;
};

export type ParsedMeasurementRow = {
  rowNumber: number;
  measurementId: string;
  measurementSetId: string;
  templateId: string;
  measurementName: string;
  unit: string;
  minLimit: number | null;
  maxLimit: number | null;
  targetValue: string | null;
  inputType: JobMeasurementInputType;
  mandatoryFlag: boolean;
  remarks: string | null;
};

export type ParsedChecklistRow = {
  rowNumber: number;
  checklistItemId: string;
  checklistId: string;
  templateId: string;
  sequenceNo: number;
  inspectionItem: string;
  acceptanceCriteria: string;
  responseType: JobChecklistResponseType;
  photoRequiredOnFail: boolean;
  mandatoryFlag: boolean;
  remarks: string | null;
};

export type ParsedScopeStepRow = {
  rowNumber: number;
  scopeStepId: string;
  scopeOfWorkId: string;
  templateId: string;
  sequenceNo: number;
  workStep: string;
  responsibleParty: JobScopeResponsibleParty;
  permitRequired: string | null;
  qaHoldPoint: boolean;
  classHoldPoint: boolean;
};

export type ParsedAttachmentRow = {
  rowNumber: number;
  attachmentRequirementId: string;
  templateId: string;
  attachmentType: JobAttachmentType;
  attachmentName: string;
  stage: JobAttachmentStage;
  mandatoryFlag: boolean;
  allowedFileTypes: string;
  remarks: string | null;
};

export type ParsedSpareRow = {
  rowNumber: number;
  spareMapId: string;
  jobId: string;
  templateId: string;
  itemType: JobSpareItemType;
  itemName: string;
  quantityBasis: JobQuantityBasis;
  recommendedQty: number | null;
  ownerSupplyFlag: boolean;
  yardSupplyFlag: boolean;
  remarks: string | null;
};

export type ParsedRfqRow = {
  rowNumber: number;
  mappingId: string;
  jobId: string;
  rfqSection: string;
  quoteComparisonSection: string;
  budgetCategory: string;
  costCode: string;
  workshop: string;
  pricingBasis: JobPricingBasis;
  discountApplicable: boolean;
  netItemFlag: boolean;
};

export type ParsedWorkflowRow = {
  rowNumber: number;
  workflowId: string;
  templateId: string;
  createdByRole: string;
  reviewByRole: string;
  approveByRole: string;
  shipyardUpdateRole: string | null;
  classApprovalRequired: boolean;
  ownerApprovalRequired: boolean;
  statusFlow: string;
};

export type ParsedMtilWorkbook = {
  libraryVersion: string | null;
  /** True when workbook sheets are placeholder stubs awaiting curated content. */
  initializedOnly?: boolean;
  masterJobs: ParsedMasterJobRow[];
  templates: ParsedTemplateRow[];
  measurements: ParsedMeasurementRow[];
  checklistItems: ParsedChecklistRow[];
  scopeSteps: ParsedScopeStepRow[];
  attachments: ParsedAttachmentRow[];
  spares: ParsedSpareRow[];
  rfqMappings: ParsedRfqRow[];
  workflows: ParsedWorkflowRow[];
};

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  let sheet = workbook.Sheets[sheetName];
  if (!sheet && sheetName === MTIL_WORKBOOK_SHEETS.attachments) {
    sheet = workbook.Sheets["06_Attachments"];
  }
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function parseLibraryVersionFromDashboard(workbook: XLSX.WorkBook): string | null {
  const rows = sheetRows(workbook, "00_Release_Dashboard");
  for (const row of rows) {
    const metric = cellStr(row["Metric"]).toLowerCase();
    if (metric === "library version") {
      const version = cellStr(row["Value"]);
      return version || null;
    }
  }
  return null;
}

function isInitializedWorkbook(workbook: XLSX.WorkBook, masterJobRows: ParsedMasterJobRow[]): boolean {
  if (masterJobRows.length > 0) return false;
  const dash = sheetRows(workbook, "00_Release_Dashboard");
  for (const row of dash) {
    const status = cellStr(row["Metric"]).toLowerCase();
    if (status === "status") {
      const value = cellStr(row["Value"]).toLowerCase();
      if (value.includes("initialized") || value.includes("foundation")) return true;
    }
  }
  const raw = sheetRows(workbook, MTIL_WORKBOOK_SHEETS.masterJobs);
  const text = raw.flatMap((row) => Object.values(row).map((v) => cellStr(v).toLowerCase())).join(" ");
  return text.includes("initialized");
}

function parseMasterJobs(rows: Array<Record<string, unknown>>): ParsedMasterJobRow[] {
  return rows
    .map((row, index) => {
      const jobId = cellStr(row["Job ID"]);
      if (!jobId) return null;
      return {
        rowNumber: index + 2,
        jobId,
        libraryVersion: cellStr(row["Library Version"]) || "MTIL-v0.4",
        department: mapDepartment(row["Department"]),
        systemGroup: cellStr(row["System Group"]),
        machinery: cellStr(row["Machinery"] ?? row["Machinery/System"]),
        component: cellStr(row["Component"]),
        subComponent: cellStr(row["Sub Component"]) || null,
        standardJobName: cellStr(row["Standard Job Name"]),
        jobDescription: cellStr(row["Job Description"]),
        applicableVesselTypes: mapVesselTypes(row["Applicable Vessel Types"]),
        applicableProjectTypes: mapProjectTypes(row["Applicable Project Types"]),
        surveyType: cellStr(row["Survey Type"]) || null,
        workshop: mapWorkshop(row["Workshop"]),
        responsibleUserRole: cellStr(row["Responsible User Role"]),
        reviewRole: cellStr(row["Review Role"]),
        approvalRole: cellStr(row["Approval Role"]),
        templateId: cellStr(row["Template ID"]),
        measurementSetId: cellStr(row["Measurement Set ID"]) || null,
        inspectionChecklistId: cellStr(row["Inspection Checklist ID"]) || null,
        scopeOfWorkId: cellStr(row["Scope of Work ID"]) || null,
        rfqCategory: cellStr(row["RFQ Category"]),
        budgetCategory: cellStr(row["Budget Category"]),
        dryDockCostCode: cellStr(row["Dry Dock Cost Code"]),
        mandatoryFlag: ynBool(row["Mandatory Flag"], "Mandatory Flag"),
        classHoldPoint: ynBool(row["Class Hold Point"], "Class Hold Point"),
        makerAttendanceRequired: ynBool(row["Maker Attendance Required"], "Maker Attendance Required"),
        permitRequired: parsePermitList(row["Permit Required"]),
        photoRequired: ynBool(row["Photo Required"], "Photo Required"),
        attachmentRequired: ynBool(row["Attachment Required"], "Attachment Required"),
        standardManHours: parseOptionalFloat(row["Standard Manhours"]),
        riskLevel: mapRiskLevel(row["Risk Level"]),
        activeFlag: ynBool(row["Active Flag"], "Active Flag"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedMasterJobRow => row !== null);
}

function parseTemplates(rows: Array<Record<string, unknown>>): ParsedTemplateRow[] {
  return rows
    .map((row, index) => {
      const templateId = cellStr(row["Template ID"]);
      if (!templateId) return null;
      return {
        rowNumber: index + 2,
        templateId,
        templateName: cellStr(row["Template Name"]),
        templateCategory: mapTemplateCategory(row["Template Category"]),
        version: cellStr(row["Version"]) || "v1.0",
        formSections: parseFormSections(row["Form Sections"]),
        autoFillFields: parseAutoFillFields(row["Auto Fill Fields"]),
        manualInputFields: parseManualInputFields(row["Manual Input Fields"]),
        requiredPhotos: parseRequiredPhotos(row["Required Photos"]),
        requiredAttachments: parseRequiredAttachments(row["Required Attachments"]),
        measurementSetId: cellStr(row["Measurement Set ID"]) || null,
        checklistId: cellStr(row["Checklist ID"]) || null,
        approvalWorkflowId: cellStr(row["Approval Workflow ID"]),
        uiLayoutType: mapUiLayout(row["UI Layout Type"]),
        activeFlag: ynBool(row["Active Flag"], "Active Flag"),
      };
    })
    .filter((row): row is ParsedTemplateRow => row !== null);
}

function parseMeasurements(rows: Array<Record<string, unknown>>): ParsedMeasurementRow[] {
  return rows
    .map((row, index) => {
      const measurementId = cellStr(row["Measurement ID"]);
      if (!measurementId) return null;
      return {
        rowNumber: index + 2,
        measurementId,
        measurementSetId: cellStr(row["Measurement Set ID"]),
        templateId: cellStr(row["Template ID"]),
        measurementName: cellStr(row["Measurement Name"]),
        unit: cellStr(row["Unit"]) || "—",
        minLimit: parseOptionalFloat(row["Min Limit"]),
        maxLimit: parseOptionalFloat(row["Max Limit"]),
        targetValue: cellStr(row["Target Value"]) || null,
        inputType: mapInputType(row["Input Type"]),
        mandatoryFlag: ynBool(row["Mandatory Flag"], "Mandatory Flag"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedMeasurementRow => row !== null);
}

function parseChecklist(rows: Array<Record<string, unknown>>): ParsedChecklistRow[] {
  return rows
    .map((row, index) => {
      const checklistItemId = cellStr(row["Checklist Item ID"]);
      if (!checklistItemId) return null;
      return {
        rowNumber: index + 2,
        checklistItemId,
        checklistId: cellStr(row["Checklist ID"]),
        templateId: cellStr(row["Template ID"]),
        sequenceNo: Number(row["Sequence No"]) || index + 1,
        inspectionItem: cellStr(row["Inspection Item"]),
        acceptanceCriteria: cellStr(row["Acceptance Criteria"]),
        responseType: mapResponseType(row["Response Type"]),
        photoRequiredOnFail: ynBool(row["Photo Required On Fail"], "Photo Required On Fail"),
        mandatoryFlag: ynBool(row["Mandatory Flag"], "Mandatory Flag"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedChecklistRow => row !== null);
}

function parseScope(rows: Array<Record<string, unknown>>): ParsedScopeStepRow[] {
  return rows
    .map((row, index) => {
      const scopeStepId = cellStr(row["Scope Step ID"]);
      if (!scopeStepId) return null;
      const permit = cellStr(row["Permit Required"]);
      return {
        rowNumber: index + 2,
        scopeStepId,
        scopeOfWorkId: cellStr(row["Scope of Work ID"]),
        templateId: cellStr(row["Template ID"]),
        sequenceNo: Number(row["Sequence No"]) || index + 1,
        workStep: cellStr(row["Work Step"]),
        responsibleParty: mapResponsibleParty(row["Responsible Party"]),
        permitRequired: permit && permit.toUpperCase() !== "N" ? permit : null,
        qaHoldPoint: ynBool(row["QA Hold Point"], "QA Hold Point"),
        classHoldPoint: ynBool(row["Class Hold Point"], "Class Hold Point"),
      };
    })
    .filter((row): row is ParsedScopeStepRow => row !== null);
}

function parseAttachments(rows: Array<Record<string, unknown>>): ParsedAttachmentRow[] {
  return rows
    .map((row, index) => {
      const attachmentRequirementId = cellStr(row["Attachment Requirement ID"]);
      if (!attachmentRequirementId) return null;
      return {
        rowNumber: index + 2,
        attachmentRequirementId,
        templateId: cellStr(row["Template ID"]),
        attachmentType: mapAttachmentType(row["Attachment Type"]),
        attachmentName: cellStr(row["Attachment Name"]),
        stage: mapAttachmentStage(row["Stage"]),
        mandatoryFlag: ynBool(row["Mandatory Flag"], "Mandatory Flag"),
        allowedFileTypes: cellStr(row["Allowed File Types"]) || "jpg,png,pdf",
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedAttachmentRow => row !== null);
}

function parseSpares(rows: Array<Record<string, unknown>>): ParsedSpareRow[] {
  return rows
    .map((row, index) => {
      const spareMapId = cellStr(row["Spare Map ID"]);
      if (!spareMapId) return null;
      return {
        rowNumber: index + 2,
        spareMapId,
        jobId: cellStr(row["Job ID"]),
        templateId: cellStr(row["Template ID"]),
        itemType: mapItemType(row["Item Type"]),
        itemName: cellStr(row["Item Name"]),
        quantityBasis: mapQuantityBasis(row["Quantity Basis"]),
        recommendedQty: parseOptionalFloat(row["Recommended Qty"]),
        ownerSupplyFlag: ynBool(row["Owner Supply Flag"], "Owner Supply Flag"),
        yardSupplyFlag: ynBool(row["Yard Supply Flag"], "Yard Supply Flag"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedSpareRow => row !== null);
}

function parseRfq(rows: Array<Record<string, unknown>>): ParsedRfqRow[] {
  return rows
    .map((row, index) => {
      const mappingId = cellStr(row["Mapping ID"]);
      if (!mappingId) return null;
      return {
        rowNumber: index + 2,
        mappingId,
        jobId: cellStr(row["Job ID"]),
        rfqSection: cellStr(row["RFQ Section"]),
        quoteComparisonSection: cellStr(row["Quote Comparison Section"]),
        budgetCategory: cellStr(row["Budget Category"]),
        costCode: cellStr(row["Cost Code"]),
        workshop: cellStr(row["Workshop"]),
        pricingBasis: mapPricingBasis(row["Pricing Basis"]),
        discountApplicable: ynBool(row["Discount Applicable"], "Discount Applicable"),
        netItemFlag: ynBool(row["Net Item Flag"], "Net Item Flag"),
      };
    })
    .filter((row): row is ParsedRfqRow => row !== null);
}

function parseWorkflows(rows: Array<Record<string, unknown>>): ParsedWorkflowRow[] {
  return rows
    .map((row, index) => {
      const workflowId = cellStr(row["Workflow ID"]);
      if (!workflowId) return null;
      return {
        rowNumber: index + 2,
        workflowId,
        templateId: cellStr(row["Template ID"]),
        createdByRole: cellStr(row["Created By Role"]),
        reviewByRole: cellStr(row["Review By Role"]),
        approveByRole: cellStr(row["Approve By Role"]),
        shipyardUpdateRole: cellStr(row["Shipyard Update Role"]) || null,
        classApprovalRequired: ynBool(row["Class Approval Required"], "Class Approval Required"),
        ownerApprovalRequired: ynBool(row["Owner Approval Required"], "Owner Approval Required"),
        statusFlow: normalizeStatusFlow(row["Status Flow"]),
      };
    })
    .filter((row): row is ParsedWorkflowRow => row !== null);
}

export function parseMtilWorkbookBuffer(buffer: ArrayBuffer | Uint8Array): ParsedMtilWorkbook {
  const workbook = XLSX.read(buffer, { type: "array" });
  const masterJobs = parseMasterJobs(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.masterJobs));
  const libraryVersion = masterJobs[0]?.libraryVersion ?? parseLibraryVersionFromDashboard(workbook);
  const initializedOnly = isInitializedWorkbook(workbook, masterJobs);

  return {
    libraryVersion,
    initializedOnly,
    masterJobs,
    templates: parseTemplates(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.templates)),
    measurements: parseMeasurements(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.measurements)),
    checklistItems: parseChecklist(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.checklist)),
    scopeSteps: parseScope(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.scope)),
    attachments: parseAttachments(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.attachments)),
    spares: parseSpares(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.spares)),
    rfqMappings: parseRfq(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.rfq)),
    workflows: parseWorkflows(sheetRows(workbook, MTIL_WORKBOOK_SHEETS.workflows)),
  };
}

export function parseMtilWorkbookFile(path: string): ParsedMtilWorkbook {
  const workbook = XLSX.readFile(path);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return parseMtilWorkbookBuffer(bytes);
}
