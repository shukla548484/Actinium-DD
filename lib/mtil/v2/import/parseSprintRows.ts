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
import type { JobAutoFillFieldDef, JobManualInputFieldDef } from "@/lib/jobCatalog/types";
import {
  cellStr,
  inferAutoFillSource,
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
  parseFormSections,
  parseOptionalFloat,
  parseRequiredAttachments,
  parseRequiredPhotos,
  splitSemicolon,
  ynBool,
} from "@/lib/mtil/import/excelValues";

function parseAutoFillFromSemicolon(value: unknown): JobAutoFillFieldDef[] {
  return splitSemicolon(value).map((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return {
      key,
      label,
      source: inferAutoFillSource(label),
      path: key,
    };
  });
}

function parseManualSections(value: unknown): JobManualInputFieldDef[] {
  return splitSemicolon(value).map((label) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    return {
      key,
      label,
      type: "text",
      section: "condition",
      required: false,
    };
  });
}

function sequenceNo(row: Record<string, unknown>, index: number): number {
  const raw = row["Sequence No"] ?? row["Seq"];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

export function parseMasterJobs(rows: Array<Record<string, unknown>>): ParsedMasterJobRow[] {
  return rows
    .map((row, index) => {
      const jobId = cellStr(row["Job ID"]);
      if (!jobId) return null;
      const photos = cellStr(row["Required Photos"]);
      const attachments = cellStr(row["Required Attachments"]);
      return {
        rowNumber: index + 2,
        jobId,
        libraryVersion: cellStr(row["Release"]) || "V2.0.1",
        department: mapDepartment(row["Department"]),
        systemGroup: cellStr(row["System"]),
        machinery: cellStr(row["Machinery"]),
        component: cellStr(row["Component"]),
        subComponent: cellStr(row["Equipment Code"]) || null,
        standardJobName: cellStr(row["Standard Job"] || row["Job Heading"]),
        jobDescription: cellStr(row["Detailed Scope"] || row["Standard Job"]),
        applicableVesselTypes: mapVesselTypes(row["Vessel Types"] ?? row["Applicable Vessel Types"]),
        applicableProjectTypes: mapProjectTypes(row["Project Types"] ?? row["Applicable Project Types"]),
        surveyType: cellStr(row["Survey Type"]) || null,
        workshop: mapWorkshop(row["Workshop"]),
        responsibleUserRole: cellStr(row["Responsible Vessel Role"] ?? row["Responsible User Role"]),
        reviewRole: cellStr(row["Review Role"]),
        approvalRole: cellStr(row["Approval Role"]),
        templateId: cellStr(row["Template ID"]),
        measurementSetId: cellStr(row["Measurement Set ID"]) || null,
        inspectionChecklistId: cellStr(row["Inspection Checklist ID"]) || null,
        scopeOfWorkId: cellStr(row["Scope of Work ID"]) || null,
        rfqCategory: cellStr(row["RFQ Category"]),
        budgetCategory: cellStr(row["Budget Category"]),
        dryDockCostCode: cellStr(row["Cost Code"] ?? row["Dry Dock Cost Code"]),
        mandatoryFlag: true,
        classHoldPoint: ynBool(row["Class Hold Point"], "Class Hold Point"),
        makerAttendanceRequired: ynBool(row["Maker Attendance"] ?? row["Maker Attendance Required"], "Maker Attendance"),
        permitRequired: [] as string[],
        photoRequired: Boolean(photos),
        attachmentRequired: Boolean(attachments),
        standardManHours: parseOptionalFloat(row["Estimated Manhours"] ?? row["Standard Manhours"]),
        riskLevel: mapRiskLevel(row["Risk Level"]),
        activeFlag: ynBool(row["Active"] ?? row["Active Flag"], "Active"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedMasterJobRow => row !== null);
}

export function parseTemplates(rows: Array<Record<string, unknown>>): ParsedTemplateRow[] {
  return rows
    .map((row, index) => {
      const templateId = cellStr(row["Template ID"]);
      if (!templateId) return null;
      const manualSections = row["Manual Input Sections"] ?? row["Manual Input Fields"];
      return {
        rowNumber: index + 2,
        templateId,
        templateName: cellStr(row["Template Name"]),
        templateCategory: mapTemplateCategory(row["Template Type"] ?? row["Template Category"]),
        version: cellStr(row["Release"] ?? row["Version"]) || "V2.0.1",
        formSections: parseFormSections(manualSections),
        autoFillFields: parseAutoFillFromSemicolon(row["Auto-Fill Fields"] ?? row["Auto Fill Fields"]),
        manualInputFields: parseManualSections(manualSections),
        requiredPhotos: parseRequiredPhotos(row["Photo Slots"] ?? row["Required Photos"]),
        requiredAttachments: parseRequiredAttachments(row["Attachment Slots"] ?? row["Required Attachments"]),
        measurementSetId: cellStr(row["Measurement Set ID"]) || null,
        checklistId: cellStr(row["Checklist ID"] ?? row["Inspection Checklist ID"]) || null,
        approvalWorkflowId: cellStr(row["Workflow ID"] ?? row["Approval Workflow ID"]),
        uiLayoutType: mapUiLayout(row["UI Layout"] ?? row["UI Layout Type"]),
        activeFlag: ynBool(row["Active"] ?? row["Active Flag"], "Active"),
      };
    })
    .filter((row): row is ParsedTemplateRow => row !== null);
}

export function parseMeasurements(rows: Array<Record<string, unknown>>): ParsedMeasurementRow[] {
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
        targetValue: cellStr(row["Target / Acceptance"] ?? row["Target Value"]) || null,
        inputType: mapInputType(row["Input Type"]),
        mandatoryFlag: ynBool(row["Mandatory"] ?? row["Mandatory Flag"], "Mandatory"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedMeasurementRow => row !== null);
}

export function parseChecklist(rows: Array<Record<string, unknown>>): ParsedChecklistRow[] {
  return rows
    .map((row, index) => {
      const checklistItemId = cellStr(row["Checklist Item ID"]);
      if (!checklistItemId) return null;
      return {
        rowNumber: index + 2,
        checklistItemId,
        checklistId: cellStr(row["Checklist ID"]),
        templateId: cellStr(row["Template ID"]),
        sequenceNo: sequenceNo(row, index),
        inspectionItem: cellStr(row["Inspection Item"]),
        acceptanceCriteria: cellStr(row["Acceptance Criteria"]),
        responseType: mapResponseType(row["Response Type"]),
        photoRequiredOnFail: ynBool(row["Photo Required on Fail"] ?? row["Photo Required On Fail"], "Photo Required on Fail"),
        mandatoryFlag: ynBool(row["Mandatory"] ?? row["Mandatory Flag"], "Mandatory"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedChecklistRow => row !== null);
}

export function parseScope(rows: Array<Record<string, unknown>>): ParsedScopeStepRow[] {
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
        sequenceNo: sequenceNo(row, index),
        workStep: cellStr(row["Work Step"]),
        responsibleParty: mapResponsibleParty(row["Responsible Party"]),
        permitRequired: permit && permit.toUpperCase() !== "N" ? permit : null,
        qaHoldPoint: ynBool(row["QA Hold Point"], "QA Hold Point"),
        classHoldPoint: ynBool(row["Class Hold Point"], "Class Hold Point"),
      };
    })
    .filter((row): row is ParsedScopeStepRow => row !== null);
}

export function parseSpares(rows: Array<Record<string, unknown>>): ParsedSpareRow[] {
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
        ownerSupplyFlag: ynBool(row["Owner Supply"] ?? row["Owner Supply Flag"], "Owner Supply"),
        yardSupplyFlag: ynBool(row["Yard Supply"] ?? row["Yard Supply Flag"], "Yard Supply"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedSpareRow => row !== null);
}

export function parseRfq(rows: Array<Record<string, unknown>>): ParsedRfqRow[] {
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
        workshop: cellStr(row["Workshop"]) || "Machinery Workshop",
        pricingBasis: mapPricingBasis(row["Pricing Basis"]),
        discountApplicable: ynBool(row["Discount Applicable"], "Discount Applicable"),
        netItemFlag: ynBool(row["Net Item Flag"], "Net Item Flag"),
      };
    })
    .filter((row): row is ParsedRfqRow => row !== null);
}

export function parseWorkflows(rows: Array<Record<string, unknown>>): ParsedWorkflowRow[] {
  return rows
    .map((row, index) => {
      const workflowId = cellStr(row["Workflow ID"]);
      if (!workflowId) return null;
      return {
        rowNumber: index + 2,
        workflowId,
        templateId: cellStr(row["Template ID"]),
        createdByRole: cellStr(row["Created By"] ?? row["Created By Role"]),
        reviewByRole: cellStr(row["Reviewed By"] ?? row["Review By Role"]),
        approveByRole: cellStr(row["Approved By"] ?? row["Approve By Role"]),
        shipyardUpdateRole: cellStr(row["Shipyard Update Role"]) || null,
        classApprovalRequired: ynBool(row["Class Step"] ?? row["Class Approval Required"], "Class Step"),
        ownerApprovalRequired: ynBool(row["Maker Step"] ?? row["Owner Approval Required"], "Maker Step"),
        statusFlow: normalizeStatusFlow(row["Status Flow"]),
      };
    })
    .filter((row): row is ParsedWorkflowRow => row !== null);
}
