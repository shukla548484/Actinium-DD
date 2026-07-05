/** V2.0 job attribute groups — ~60–80 fields for Excel / SQL / Prisma / API parity. */

export const MTIL_V2_JOB_FIELD_GROUPS = {
  identity: [
    "engineeringJobCode",
    "jobId",
    "libraryVersion",
    "machineryCode",
    "machineryName",
    "componentCode",
    "componentName",
    "subComponentCode",
    "subComponentName",
    "systemGroup",
    "department",
    "action",
    "workshop",
  ],
  applicability: ["vesselApplicability", "projectApplicability", "surveyApplicability"],
  scope: ["jobHeading", "detailedScope", "acceptanceCriteria"],
  linkedLibraries: ["templateId", "inspectionChecklistId", "measurementSetId", "scopeOfWorkId"],
  resources: ["requiredTools", "requiredPpe", "requiredSpareParts", "requiredConsumables"],
  documentation: [
    "requiredServiceReports",
    "requiredCertificates",
    "requiredPhotos",
    "beforeAfterImages",
  ],
  governance: [
    "classHoldPoints",
    "flagHoldPoints",
    "ownerApprovalRequired",
    "yardApprovalRequired",
    "makerAttendanceRequired",
    "permitRequired",
  ],
  commercial: ["rfqCategory", "budgetCategory", "costCode"],
  planning: [
    "plannedManHours",
    "estimatedDurationDays",
    "responsibleDepartment",
    "responsibleRole",
    "reviewRole",
    "approvalRole",
    "workflowId",
    "defaultPriority",
    "riskLevel",
  ],
  technicalMapping: ["sqlTableMapping", "prismaModelMapping", "apiResourceMapping"],
  meta: ["activeFlag", "remarks"],
} as const;

export const MTIL_V2_JOB_FIELD_COUNT = Object.values(MTIL_V2_JOB_FIELD_GROUPS).flat().length;

export const MTIL_V2_TEMPLATE_FIELD_GROUPS = {
  identity: ["templateId", "templateName", "libraryVersion", "category"],
  autoFill: [
    "autoMachineryInformation",
    "autoRunningHours",
    "autoLastOverhaulDate",
    "autoPreviousDryDockReference",
    "autoVesselParticulars",
  ],
  attachments: [
    "imageAttachments",
    "pdfAttachments",
    "calibrationCertificates",
    "ndtReports",
    "classReports",
    "thicknessReports",
    "pressureTestReports",
    "beforeAfterComparison",
  ],
  workflow: ["digitalSignatures", "approvalWorkflow", "revisionHistory", "auditLog"],
  linkedLibraries: ["measurementSetId", "checklistId"],
  meta: ["activeFlag"],
} as const;

/** Default SQL / Prisma / API mappings for V2.0 normalized import. */
export const MTIL_V2_DEFAULT_SQL_MAPPING = {
  job: "master_job_library",
  template: "job_dynamic_template",
  measurement: "job_measurement",
  checklist: "job_checklist_item",
  spare: "job_spare_mapping",
  rfq: "job_rfq_budget_mapping",
  workflow: "job_approval_workflow",
  scope: "job_scope_step",
  attachment: "job_attachment_requirement",
} as const;

export const MTIL_V2_DEFAULT_PRISMA_MAPPING = {
  job: "MasterJobLibrary",
  template: "JobDynamicTemplate",
  measurement: "JobMeasurement",
  checklist: "JobChecklistItem",
  spare: "JobSpareMapping",
  rfq: "JobRfqBudgetMapping",
  workflow: "JobApprovalWorkflow",
  scope: "JobScopeStep",
  attachment: "JobAttachmentRequirement",
} as const;

export const MTIL_V2_DEFAULT_API_MAPPING = {
  job: "/api/admin/job-catalog/master-jobs",
  template: "/api/admin/job-catalog/templates",
  measurement: "/api/admin/job-catalog/measurements",
  checklist: "/api/admin/job-catalog/checklists",
  spare: "/api/admin/job-catalog/spares",
  rfq: "/api/admin/job-catalog/rfq-mappings",
  domain: "/api/admin/mtil/v2/domains",
  progress: "/api/admin/mtil/v2",
} as const;
