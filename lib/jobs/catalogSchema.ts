/**
 * Job catalog spreadsheet schema — field manifests for tabs 01–09 + Lists.
 * Used to validate imports and dynamic template generation.
 */

export type JobCatalogFieldDef = {
  fieldNo: number;
  fieldName: string;
  dataType: string;
  required: boolean;
  example?: string;
  purpose: string;
  source: string;
  notes?: string;
};

export type JobCatalogSheetDef = {
  sheetNo: number;
  sheetKey: string;
  sheetName: string;
  modelName: string;
  tableName: string;
  fields: JobCatalogFieldDef[];
};

/** 01_Master_Job_Library — 33 fields */
export const MASTER_JOB_LIBRARY_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "jobId", dataType: "Text", required: true, example: "JOB-ENG-ME-0001", purpose: "Unique standard job identifier", source: "System", notes: "Must be unique" },
  { fieldNo: 2, fieldName: "libraryVersion", dataType: "Text", required: true, example: "MTIL-v0.3", purpose: "Library version of this row", source: "System", notes: "Version controlled" },
  { fieldNo: 3, fieldName: "department", dataType: "Enum", required: true, example: "Engine", purpose: "Primary department", source: "Admin", notes: "Engine/Deck/Electrical/Hull/Safety" },
  { fieldNo: 4, fieldName: "systemGroup", dataType: "Text", required: true, example: "Main Propulsion", purpose: "High-level system grouping", source: "Technical" },
  { fieldNo: 5, fieldName: "machinery", dataType: "Text", required: true, example: "Main Engine", purpose: "Machinery name", source: "Technical" },
  { fieldNo: 6, fieldName: "component", dataType: "Text", required: true, example: "Maneuvering System", purpose: "Component name", source: "Technical" },
  { fieldNo: 7, fieldName: "subComponent", dataType: "Text", required: false, example: "Air distributor", purpose: "Sub-component if applicable", source: "Technical" },
  { fieldNo: 8, fieldName: "standardJobName", dataType: "Text", required: true, example: "Maneuvering system 5-year maintenance", purpose: "Standard job title", source: "Technical", notes: "Use controlled naming" },
  { fieldNo: 9, fieldName: "jobDescription", dataType: "Long Text", required: true, example: "Inspect, overhaul and test...", purpose: "Detailed job description", source: "Technical" },
  { fieldNo: 10, fieldName: "applicableVesselTypes", dataType: "Multi Enum", required: true, example: "All; Oil Tanker; Bulk Carrier", purpose: "Vessel types where job applies", source: "Technical", notes: "Use Lists sheet" },
  { fieldNo: 11, fieldName: "applicableProjectTypes", dataType: "Multi Enum", required: true, example: "Special Survey; Intermediate Survey", purpose: "Project types where job applies", source: "Technical" },
  { fieldNo: 12, fieldName: "surveyType", dataType: "Text", required: false, example: "Special Survey", purpose: "Survey linkage", source: "Technical" },
  { fieldNo: 13, fieldName: "workshop", dataType: "Enum", required: true, example: "Machinery Workshop", purpose: "Shipyard workshop mapping", source: "Shipyard" },
  { fieldNo: 14, fieldName: "responsibleUserRole", dataType: "Enum", required: true, example: "Chief Engineer", purpose: "Main input role", source: "System" },
  { fieldNo: 15, fieldName: "reviewRole", dataType: "Enum", required: true, example: "Technical Superintendent", purpose: "Reviewing role", source: "System" },
  { fieldNo: 16, fieldName: "approvalRole", dataType: "Enum", required: true, example: "Technical Manager", purpose: "Approval role", source: "System" },
  { fieldNo: 17, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Dynamic template linked to job", source: "System", notes: "Must exist in Template Library" },
  { fieldNo: 18, fieldName: "measurementSetId", dataType: "Text", required: false, example: "MEA-ENG-ME-0017", purpose: "Measurement set", source: "System" },
  { fieldNo: 19, fieldName: "inspectionChecklistId", dataType: "Text", required: false, example: "INS-ENG-ME-0017", purpose: "Checklist mapping", source: "System" },
  { fieldNo: 20, fieldName: "scopeOfWorkId", dataType: "Text", required: false, example: "SOW-ENG-ME-0017", purpose: "Standard scope mapping", source: "System" },
  { fieldNo: 21, fieldName: "rfqCategory", dataType: "Text", required: true, example: "Main Engine Works", purpose: "RFQ section", source: "Commercial" },
  { fieldNo: 22, fieldName: "budgetCategory", dataType: "Text", required: true, example: "Main Engine Works", purpose: "Budget mapping", source: "Commercial" },
  { fieldNo: 23, fieldName: "dryDockCostCode", dataType: "Text", required: true, example: "DD-1000", purpose: "Cost code mapping", source: "Commercial" },
  { fieldNo: 24, fieldName: "mandatoryFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Whether standard mandatory job", source: "Technical", notes: "Y/N" },
  { fieldNo: 25, fieldName: "classHoldPoint", dataType: "Boolean", required: true, example: "N", purpose: "Class hold point requirement", source: "Technical", notes: "Y/N" },
  { fieldNo: 26, fieldName: "makerAttendanceRequired", dataType: "Boolean", required: true, example: "Y", purpose: "Maker attendance required", source: "Technical", notes: "Y/N" },
  { fieldNo: 27, fieldName: "permitRequired", dataType: "Multi Enum", required: false, example: "Hot Work; Isolation", purpose: "Permit requirement", source: "Safety" },
  { fieldNo: 28, fieldName: "photoRequired", dataType: "Boolean", required: true, example: "Y", purpose: "Photo requirement", source: "System", notes: "Y/N" },
  { fieldNo: 29, fieldName: "attachmentRequired", dataType: "Boolean", required: true, example: "Y", purpose: "Report/attachment requirement", source: "System", notes: "Y/N" },
  { fieldNo: 30, fieldName: "standardManHours", dataType: "Number", required: false, example: "24", purpose: "Estimated yard/crew manhours", source: "Commercial" },
  { fieldNo: 31, fieldName: "riskLevel", dataType: "Enum", required: true, example: "Medium", purpose: "Job risk level", source: "HSEQ", notes: "Low/Medium/High/Critical" },
  { fieldNo: 32, fieldName: "activeFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Can be selected in app", source: "System", notes: "Y/N" },
  { fieldNo: 33, fieldName: "remarks", dataType: "Long Text", required: false, purpose: "Notes", source: "All" },
];

/** 02_Dynamic_Template_Library — 14 fields */
export const DYNAMIC_TEMPLATE_LIBRARY_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Unique template identifier", source: "System" },
  { fieldNo: 2, fieldName: "templateName", dataType: "Text", required: true, example: "Maneuvering System 5-Year Maintenance", purpose: "Template display name", source: "Technical" },
  { fieldNo: 3, fieldName: "templateCategory", dataType: "Enum", required: true, example: "Machinery Overhaul", purpose: "Reusable template group", source: "System" },
  { fieldNo: 4, fieldName: "version", dataType: "Text", required: true, example: "v1.0", purpose: "Template version", source: "System" },
  { fieldNo: 5, fieldName: "formSections", dataType: "JSON/Text", required: true, example: "Job Info; Auto Data; Inspection; Measurements; Photos; Approval", purpose: "Sections rendered by the application", source: "System" },
  { fieldNo: 6, fieldName: "autoFillFields", dataType: "JSON/Text", required: true, example: "Vessel, IMO, Machinery, Maker, Model, RH", purpose: "Fields auto-populated from the database", source: "System" },
  { fieldNo: 7, fieldName: "manualInputFields", dataType: "JSON/Text", required: true, example: "Condition, Findings, Recommendations", purpose: "Fields entered by the user", source: "System" },
  { fieldNo: 8, fieldName: "requiredPhotos", dataType: "JSON/Text", required: true, example: "Before; During; After; Nameplate", purpose: "Photo slots for the job", source: "System" },
  { fieldNo: 9, fieldName: "requiredAttachments", dataType: "JSON/Text", required: true, example: "Service report; Test certificate", purpose: "Attachment slots for documents", source: "System" },
  { fieldNo: 10, fieldName: "measurementSetId", dataType: "Text", required: false, example: "MEA-ENG-ME-0017", purpose: "Reference to the measurement set used", source: "System" },
  { fieldNo: 11, fieldName: "checklistId", dataType: "Text", required: false, example: "INS-ENG-ME-0017", purpose: "Reference to the inspection checklist used", source: "System" },
  { fieldNo: 12, fieldName: "approvalWorkflowId", dataType: "Text", required: true, example: "WF-DD-TECH-001", purpose: "Defines the approval workflow", source: "System" },
  { fieldNo: 13, fieldName: "uiLayoutType", dataType: "Enum", required: true, example: "Card + Tabs", purpose: "UI rendering style for the template", source: "System" },
  { fieldNo: 14, fieldName: "activeFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Indicates if the template is available for use", source: "System", notes: "Y/N" },
];

/** 03_Measurement_Library — 11 fields */
export const MEASUREMENT_LIBRARY_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "measurementId", dataType: "Text", required: true, example: "MEA-ENG-ME-0017-001", purpose: "Unique measurement identifier", source: "System" },
  { fieldNo: 2, fieldName: "measurementSetId", dataType: "Text", required: true, example: "MEA-ENG-ME-0017", purpose: "Group identifier", source: "System" },
  { fieldNo: 3, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Template mapping", source: "System" },
  { fieldNo: 4, fieldName: "measurementName", dataType: "Text", required: true, example: "Control air pressure", purpose: "Measurement name", source: "Technical" },
  { fieldNo: 5, fieldName: "unit", dataType: "Enum", required: true, example: "bar", purpose: "Measurement unit", source: "Technical" },
  { fieldNo: 6, fieldName: "minLimit", dataType: "Number", required: false, example: "6.0", purpose: "Minimum acceptable limit", source: "Technical" },
  { fieldNo: 7, fieldName: "maxLimit", dataType: "Number", required: false, example: "8.0", purpose: "Maximum acceptable limit", source: "Technical" },
  { fieldNo: 8, fieldName: "targetValue", dataType: "Number/Text", required: false, example: "7.0", purpose: "Target/normal value", source: "Technical" },
  { fieldNo: 9, fieldName: "inputType", dataType: "Enum", required: true, example: "Number", purpose: "Defines the input UI element", source: "System", notes: "Number/Text/Dropdown/Date" },
  { fieldNo: 10, fieldName: "mandatoryFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Required entry", source: "System", notes: "Y/N" },
  { fieldNo: 11, fieldName: "remarks", dataType: "Text", required: false, purpose: "Notes", source: "Technical" },
];

/** 04_Inspection_Checklist — 10 fields */
export const INSPECTION_CHECKLIST_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "checklistItemId", dataType: "Text", required: true, example: "INS-ENG-ME-0017-001", purpose: "Unique checklist item", source: "System" },
  { fieldNo: 2, fieldName: "checklistId", dataType: "Text", required: true, example: "INS-ENG-ME-0017", purpose: "Checklist group", source: "System" },
  { fieldNo: 3, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Template mapping", source: "System" },
  { fieldNo: 4, fieldName: "sequenceNo", dataType: "Number", required: true, example: "1", purpose: "Checklist order", source: "System" },
  { fieldNo: 5, fieldName: "inspectionItem", dataType: "Text", required: true, example: "Check air distributor condition", purpose: "Inspection point", source: "Technical" },
  { fieldNo: 6, fieldName: "acceptanceCriteria", dataType: "Text", required: true, example: "No sticking, abnormal wear or leakage", purpose: "Pass/fail criteria", source: "Technical" },
  { fieldNo: 7, fieldName: "responseType", dataType: "Enum", required: true, example: "Pass/Fail/NA", purpose: "How user answers", source: "System" },
  { fieldNo: 8, fieldName: "photoRequiredOnFail", dataType: "Boolean", required: true, example: "Y", purpose: "Photo required if failed", source: "System", notes: "Y/N" },
  { fieldNo: 9, fieldName: "mandatoryFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Mandatory inspection point", source: "System", notes: "Y/N" },
  { fieldNo: 10, fieldName: "remarks", dataType: "Text", required: false, purpose: "Notes", source: "Technical" },
];

/** 05_Scope_of_Work — 9 fields */
export const SCOPE_OF_WORK_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "scopeStepId", dataType: "Text", required: true, example: "SOW-ENG-ME-0017-001", purpose: "Unique scope step", source: "System" },
  { fieldNo: 2, fieldName: "scopeOfWorkId", dataType: "Text", required: true, example: "SOW-ENG-ME-0017", purpose: "Scope group", source: "System" },
  { fieldNo: 3, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Template mapping", source: "System" },
  { fieldNo: 4, fieldName: "sequenceNo", dataType: "Number", required: true, example: "1", purpose: "Step order", source: "System" },
  { fieldNo: 5, fieldName: "workStep", dataType: "Long Text", required: true, example: "Isolate control air and secure system", purpose: "Standard work instruction", source: "Technical" },
  { fieldNo: 6, fieldName: "responsibleParty", dataType: "Enum", required: true, example: "Shipyard", purpose: "Owner/Yard/Maker/Class", source: "System" },
  { fieldNo: 7, fieldName: "permitRequired", dataType: "Text", required: false, example: "Isolation permit", purpose: "Permit link", source: "Safety" },
  { fieldNo: 8, fieldName: "qaHoldPoint", dataType: "Boolean", required: true, example: "N", purpose: "QA/QC hold point", source: "QA/QC", notes: "Y/N" },
  { fieldNo: 9, fieldName: "classHoldPoint", dataType: "Boolean", required: true, example: "N", purpose: "Class hold point", source: "Class", notes: "Y/N" },
];

/** 06_Attachments_Photos — 8 fields */
export const ATTACHMENTS_PHOTOS_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "attachmentRequirementId", dataType: "Text", required: true, example: "ATT-ENG-ME-0017-001", purpose: "Unique attachment requirement identifier", source: "System" },
  { fieldNo: 2, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Template mapping", source: "System" },
  { fieldNo: 3, fieldName: "attachmentType", dataType: "Enum", required: true, example: "Photo", purpose: "Photo/Report/Certificate/Drawing/Video", source: "System" },
  { fieldNo: 4, fieldName: "attachmentName", dataType: "Text", required: true, example: "Before condition photo", purpose: "Expected name for the uploaded file", source: "System" },
  { fieldNo: 5, fieldName: "stage", dataType: "Enum", required: true, example: "Before", purpose: "Before/During/After/Final", source: "System" },
  { fieldNo: 6, fieldName: "mandatoryFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Indicates if the upload is mandatory", source: "System", notes: "Y/N" },
  { fieldNo: 7, fieldName: "allowedFileTypes", dataType: "Text", required: true, example: "jpg,png,pdf", purpose: "Comma-separated list of allowed file extensions", source: "System" },
  { fieldNo: 8, fieldName: "remarks", dataType: "Text", required: false, purpose: "General notes", source: "System" },
];

/** 07_Spares_Materials — 10 fields */
export const SPARES_MATERIALS_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "spareMapId", dataType: "Text", required: true, example: "SPR-ENG-ME-0017-001", purpose: "Unique spare mapping", source: "System" },
  { fieldNo: 2, fieldName: "jobId", dataType: "Text", required: true, example: "JOB-ENG-ME-0001", purpose: "Mapped job", source: "System" },
  { fieldNo: 3, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Mapped template", source: "System" },
  { fieldNo: 4, fieldName: "itemType", dataType: "Enum", required: true, example: "Spare", purpose: "Spare/Consumable/Tool/Material", source: "System" },
  { fieldNo: 5, fieldName: "itemName", dataType: "Text", required: true, example: "O-ring kit", purpose: "Standard item name", source: "Technical" },
  { fieldNo: 6, fieldName: "quantityBasis", dataType: "Enum", required: true, example: "Per job", purpose: "Per job/Per unit/As required", source: "Commercial" },
  { fieldNo: 7, fieldName: "recommendedQty", dataType: "Number", required: false, example: "1", purpose: "Recommended quantity", source: "Technical" },
  { fieldNo: 8, fieldName: "ownerSupplyFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Owner supply possible", source: "Commercial", notes: "Y/N" },
  { fieldNo: 9, fieldName: "yardSupplyFlag", dataType: "Boolean", required: true, example: "Y", purpose: "Yard supply possible", source: "Commercial", notes: "Y/N" },
  { fieldNo: 10, fieldName: "remarks", dataType: "Text", required: false, purpose: "Notes", source: "Technical" },
];

/** 08_RFQ_Budget_Mapping — 10 fields */
export const RFQ_BUDGET_MAPPING_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "mappingId", dataType: "Text", required: true, example: "MAP-ENG-ME-0001", purpose: "Unique mapping", source: "System" },
  { fieldNo: 2, fieldName: "jobId", dataType: "Text", required: true, example: "JOB-ENG-ME-0001", purpose: "Job mapped", source: "System" },
  { fieldNo: 3, fieldName: "rfqSection", dataType: "Text", required: true, example: "Main Engine Works", purpose: "RFQ grouping", source: "Commercial" },
  { fieldNo: 4, fieldName: "quoteComparisonSection", dataType: "Text", required: true, example: "Main Engine", purpose: "Quote normalization group", source: "Commercial" },
  { fieldNo: 5, fieldName: "budgetCategory", dataType: "Text", required: true, example: "Main Engine Works", purpose: "Budget grouping", source: "Commercial" },
  { fieldNo: 6, fieldName: "costCode", dataType: "Text", required: true, example: "DD-1000", purpose: "Dry dock cost code", source: "Commercial" },
  { fieldNo: 7, fieldName: "workshop", dataType: "Text", required: true, example: "Machinery Workshop", purpose: "Shipyard workshop", source: "Shipyard" },
  { fieldNo: 8, fieldName: "pricingBasis", dataType: "Enum", required: true, example: "Lump Sum", purpose: "Lump Sum/Per Unit/Per Day/Per Meter", source: "Commercial" },
  { fieldNo: 9, fieldName: "discountApplicable", dataType: "Boolean", required: true, example: "Y", purpose: "Discount flag", source: "Commercial", notes: "Y/N" },
  { fieldNo: 10, fieldName: "netItemFlag", dataType: "Boolean", required: true, example: "N", purpose: "Net item flag", source: "Commercial", notes: "Y/N" },
];

/** 09_Workflow_Roles — 9 fields */
export const WORKFLOW_ROLES_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "workflowId", dataType: "Text", required: true, example: "WF-DD-TECH-001", purpose: "Workflow identifier", source: "System" },
  { fieldNo: 2, fieldName: "templateId", dataType: "Text", required: true, example: "TMP-ENG-ME-0017", purpose: "Template mapping", source: "System" },
  { fieldNo: 3, fieldName: "createdByRole", dataType: "Enum", required: true, example: "Chief Engineer", purpose: "Role allowed to create", source: "System" },
  { fieldNo: 4, fieldName: "reviewByRole", dataType: "Enum", required: true, example: "Technical Superintendent", purpose: "Role allowed to review", source: "System" },
  { fieldNo: 5, fieldName: "approveByRole", dataType: "Enum", required: true, example: "Technical Manager", purpose: "Role allowed to approve", source: "System" },
  { fieldNo: 6, fieldName: "shipyardUpdateRole", dataType: "Enum", required: false, example: "Machinery Supervisor", purpose: "Yard user updating progress", source: "Shipyard" },
  { fieldNo: 7, fieldName: "classApprovalRequired", dataType: "Boolean", required: true, example: "N", purpose: "Class step needed", source: "Class", notes: "Y/N" },
  { fieldNo: 8, fieldName: "ownerApprovalRequired", dataType: "Boolean", required: true, example: "N", purpose: "Owner approval required", source: "Owner", notes: "Y/N" },
  { fieldNo: 9, fieldName: "statusFlow", dataType: "Text", required: true, example: "Draft > Submitted > Reviewed > Approved > Completed > Closed", purpose: "Allowed workflow statuses", source: "System" },
];

/** Lists — 8 controlled enum list types */
export const CATALOG_LIST_FIELDS: JobCatalogFieldDef[] = [
  { fieldNo: 1, fieldName: "projectTypes", dataType: "Enum List", required: true, example: "Special Survey; Damage Repair; ...", purpose: "Allowed project types", source: "System" },
  { fieldNo: 2, fieldName: "vesselTypes", dataType: "Enum List", required: true, example: "Oil Tanker; Chemical Tanker; ...", purpose: "Allowed vessel types", source: "System" },
  { fieldNo: 3, fieldName: "departments", dataType: "Enum List", required: true, example: "Engine; Deck; Electrical; ...", purpose: "Allowed departments", source: "System" },
  { fieldNo: 4, fieldName: "workshops", dataType: "Enum List", required: true, example: "Machinery; Pipe; Steel; ...", purpose: "Allowed shipyard workshops", source: "System" },
  { fieldNo: 5, fieldName: "riskLevels", dataType: "Enum List", required: true, example: "Low; Medium; High; Critical", purpose: "Risk values", source: "HSEQ" },
  { fieldNo: 6, fieldName: "attachmentTypes", dataType: "Enum List", required: true, example: "Photo; Report; Certificate; ...", purpose: "Upload categories", source: "System" },
  { fieldNo: 7, fieldName: "jobStatuses", dataType: "Enum List", required: true, example: "Draft; Submitted; Reviewed; ...", purpose: "Job workflow statuses", source: "System" },
  { fieldNo: 8, fieldName: "userRoles", dataType: "Enum List", required: true, example: "Chief Engineer; Master; ...", purpose: "Role options", source: "System" },
];

export const JOB_CATALOG_SHEETS: JobCatalogSheetDef[] = [
  { sheetNo: 1, sheetKey: "01_master_job_library", sheetName: "01_Master_Job_Library", modelName: "MasterJobLibrary", tableName: "master_job_library", fields: MASTER_JOB_LIBRARY_FIELDS },
  { sheetNo: 2, sheetKey: "02_dynamic_template_library", sheetName: "02_Dynamic_Template_Library", modelName: "JobDynamicTemplate", tableName: "job_dynamic_templates", fields: DYNAMIC_TEMPLATE_LIBRARY_FIELDS },
  { sheetNo: 3, sheetKey: "03_measurement_library", sheetName: "03_Measurement_Library", modelName: "JobMeasurement", tableName: "job_measurements", fields: MEASUREMENT_LIBRARY_FIELDS },
  { sheetNo: 4, sheetKey: "04_inspection_checklist", sheetName: "04_Inspection_Checklist", modelName: "JobChecklistItem", tableName: "job_checklist_items", fields: INSPECTION_CHECKLIST_FIELDS },
  { sheetNo: 5, sheetKey: "05_scope_of_work", sheetName: "05_Scope_of_Work", modelName: "JobScopeStep", tableName: "job_scope_steps", fields: SCOPE_OF_WORK_FIELDS },
  { sheetNo: 6, sheetKey: "06_attachments_photos", sheetName: "06_Attachments_Photos", modelName: "JobAttachmentRequirement", tableName: "job_attachment_requirements", fields: ATTACHMENTS_PHOTOS_FIELDS },
  { sheetNo: 7, sheetKey: "07_spares_materials", sheetName: "07_Spares_Materials", modelName: "JobSpareMapping", tableName: "job_spare_mappings", fields: SPARES_MATERIALS_FIELDS },
  { sheetNo: 8, sheetKey: "08_rfq_budget_mapping", sheetName: "08_RFQ_Budget_Mapping", modelName: "JobRfqBudgetMapping", tableName: "job_rfq_budget_mappings", fields: RFQ_BUDGET_MAPPING_FIELDS },
  { sheetNo: 9, sheetKey: "09_workflow_roles", sheetName: "09_Workflow_Roles", modelName: "JobApprovalWorkflow", tableName: "job_approval_workflows", fields: WORKFLOW_ROLES_FIELDS },
  { sheetNo: 10, sheetKey: "lists", sheetName: "Lists", modelName: "JobCatalogListItem", tableName: "job_catalog_list_items", fields: CATALOG_LIST_FIELDS },
];

/** Expected field counts per spreadsheet tab — for validation. */
export const JOB_CATALOG_FIELD_COUNTS = {
  masterJobLibrary: MASTER_JOB_LIBRARY_FIELDS.length,
  dynamicTemplateLibrary: DYNAMIC_TEMPLATE_LIBRARY_FIELDS.length,
  measurementLibrary: MEASUREMENT_LIBRARY_FIELDS.length,
  inspectionChecklist: INSPECTION_CHECKLIST_FIELDS.length,
  scopeOfWork: SCOPE_OF_WORK_FIELDS.length,
  attachmentsPhotos: ATTACHMENTS_PHOTOS_FIELDS.length,
  sparesMaterials: SPARES_MATERIALS_FIELDS.length,
  rfqBudgetMapping: RFQ_BUDGET_MAPPING_FIELDS.length,
  workflowRoles: WORKFLOW_ROLES_FIELDS.length,
  lists: CATALOG_LIST_FIELDS.length,
} as const;

export const JOB_CATALOG_TOTAL_FIELD_COUNT = Object.values(JOB_CATALOG_FIELD_COUNTS).reduce(
  (sum, n) => sum + n,
  0,
);

export function assertJobCatalogFieldCounts(): void {
  const expected = {
    masterJobLibrary: 33,
    dynamicTemplateLibrary: 14,
    measurementLibrary: 11,
    inspectionChecklist: 10,
    scopeOfWork: 9,
    attachmentsPhotos: 8,
    sparesMaterials: 10,
    rfqBudgetMapping: 10,
    workflowRoles: 9,
    lists: 8,
  };
  for (const [key, count] of Object.entries(expected)) {
    const actual = JOB_CATALOG_FIELD_COUNTS[key as keyof typeof JOB_CATALOG_FIELD_COUNTS];
    if (actual !== count) {
      throw new Error(`Job catalog field count mismatch for ${key}: expected ${count}, got ${actual}`);
    }
  }
}

assertJobCatalogFieldCounts();
