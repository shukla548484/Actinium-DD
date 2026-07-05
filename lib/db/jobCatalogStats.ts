import { prisma } from "@/lib/prisma";
import { JOB_CATALOG_FIELD_COUNTS } from "@/lib/jobs/catalogSchema";

export type JobCatalogSheetStats = {
  sheetNo: number;
  sheetKey: string;
  sheetName: string;
  tableName: string;
  fieldCount: number;
  rowCount: number;
};

export type JobCatalogStats = {
  libraryVersion: string | null;
  seeded: boolean;
  sheets: JobCatalogSheetStats[];
  totals: {
    tables: number;
    rows: number;
    spreadsheetFields: number;
  };
};

const SHEET_META: Array<{
  sheetNo: number;
  sheetKey: string;
  sheetName: string;
  tableName: string;
  fieldKey: keyof typeof JOB_CATALOG_FIELD_COUNTS;
  count: () => Promise<number>;
}> = [
  {
    sheetNo: 1,
    sheetKey: "01_master_job_library",
    sheetName: "01_Master_Job_Library",
    tableName: "master_job_library",
    fieldKey: "masterJobLibrary",
    count: () => prisma.masterJobLibrary.count(),
  },
  {
    sheetNo: 2,
    sheetKey: "02_dynamic_template_library",
    sheetName: "02_Dynamic_Template_Library",
    tableName: "job_dynamic_templates",
    fieldKey: "dynamicTemplateLibrary",
    count: () => prisma.jobDynamicTemplate.count(),
  },
  {
    sheetNo: 3,
    sheetKey: "03_measurement_library",
    sheetName: "03_Measurement_Library",
    tableName: "job_measurements",
    fieldKey: "measurementLibrary",
    count: () => prisma.jobMeasurement.count(),
  },
  {
    sheetNo: 4,
    sheetKey: "04_inspection_checklist",
    sheetName: "04_Inspection_Checklist",
    tableName: "job_checklist_items",
    fieldKey: "inspectionChecklist",
    count: () => prisma.jobChecklistItem.count(),
  },
  {
    sheetNo: 5,
    sheetKey: "05_scope_of_work",
    sheetName: "05_Scope_of_Work",
    tableName: "job_scope_steps",
    fieldKey: "scopeOfWork",
    count: () => prisma.jobScopeStep.count(),
  },
  {
    sheetNo: 6,
    sheetKey: "06_attachments_photos",
    sheetName: "06_Attachments_Photos",
    tableName: "job_attachment_requirements",
    fieldKey: "attachmentsPhotos",
    count: () => prisma.jobAttachmentRequirement.count(),
  },
  {
    sheetNo: 7,
    sheetKey: "07_spares_materials",
    sheetName: "07_Spares_Materials",
    tableName: "job_spare_mappings",
    fieldKey: "sparesMaterials",
    count: () => prisma.jobSpareMapping.count(),
  },
  {
    sheetNo: 8,
    sheetKey: "08_rfq_budget_mapping",
    sheetName: "08_RFQ_Budget_Mapping",
    tableName: "job_rfq_budget_mappings",
    fieldKey: "rfqBudgetMapping",
    count: () => prisma.jobRfqBudgetMapping.count(),
  },
  {
    sheetNo: 9,
    sheetKey: "09_workflow_roles",
    sheetName: "09_Workflow_Roles",
    tableName: "job_approval_workflows",
    fieldKey: "workflowRoles",
    count: () => prisma.jobApprovalWorkflow.count(),
  },
  {
    sheetNo: 10,
    sheetKey: "lists",
    sheetName: "Lists",
    tableName: "job_catalog_list_items",
    fieldKey: "lists",
    count: () => prisma.jobCatalogListItem.count({ where: { isActive: true } }),
  },
];

export async function getJobCatalogStats(): Promise<JobCatalogStats> {
  const counts = await Promise.all(SHEET_META.map((s) => s.count()));
  const latest = await prisma.masterJobLibrary.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { libraryVersion: true },
  });

  const sheets: JobCatalogSheetStats[] = SHEET_META.map((meta, i) => ({
    sheetNo: meta.sheetNo,
    sheetKey: meta.sheetKey,
    sheetName: meta.sheetName,
    tableName: meta.tableName,
    fieldCount: JOB_CATALOG_FIELD_COUNTS[meta.fieldKey],
    rowCount: counts[i] ?? 0,
  }));

  const templateCount = counts[1] ?? 0;

  return {
    libraryVersion: latest?.libraryVersion ?? null,
    seeded: templateCount > 0,
    sheets,
    totals: {
      tables: sheets.length,
      rows: sheets.reduce((sum, s) => sum + s.rowCount, 0),
      spreadsheetFields: Object.values(JOB_CATALOG_FIELD_COUNTS).reduce((a, b) => a + b, 0),
    },
  };
}

export async function listJobCatalogTemplates(limit = 50) {
  return prisma.jobDynamicTemplate.findMany({
    take: limit,
    orderBy: { templateId: "asc" },
    select: {
      templateId: true,
      templateName: true,
      templateCategory: true,
      version: true,
      measurementSetId: true,
      checklistId: true,
      approvalWorkflowId: true,
      activeFlag: true,
      _count: {
        select: {
          measurements: true,
          checklistItems: true,
          scopeSteps: true,
          attachmentRequirements: true,
          masterJobs: true,
        },
      },
    },
  });
}

export async function listMasterJobLibraryRows(limit = 50) {
  return prisma.masterJobLibrary.findMany({
    take: limit,
    orderBy: { jobId: "asc" },
    select: {
      jobId: true,
      libraryVersion: true,
      standardJobName: true,
      department: true,
      machinery: true,
      component: true,
      templateId: true,
      workshop: true,
      riskLevel: true,
      activeFlag: true,
    },
  });
}

export async function getJobCatalogTemplateDetail(templateId: string) {
  return prisma.jobDynamicTemplate.findUnique({
    where: { templateId },
    include: {
      approvalWorkflow: true,
      measurements: { orderBy: { measurementName: "asc" } },
      checklistItems: { orderBy: { sequenceNo: "asc" } },
      scopeSteps: { orderBy: { sequenceNo: "asc" } },
      attachmentRequirements: true,
      masterJobs: { take: 10, orderBy: { jobId: "asc" } },
    },
  });
}
