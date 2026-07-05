import type { DdJobPriority, DdRiskLevel, DryDockProjectType, JobCatalogDepartment } from "@prisma/client";
import type { MtilPhaseId } from "@/lib/mtil/types";
import type { MtilV2ComponentAction } from "./componentActions";

export type MtilV2ReleaseStatus = "pending" | "in_progress" | "completed";

/** V2.0.x domain release — upgrades one engineering domain to production library. */
export type MtilV2DomainRelease = {
  release: string;
  slug: string;
  name: string;
  status: MtilV2ReleaseStatus;
  legacyPhaseId: MtilPhaseId;
  targetJobCount: { min: number; max: number };
  idPrefix: string;
  deptCode: string;
  description: string;
  coverageAreas: string[];
};

/**
 * Production-grade engineering job — ~60–80 attributes (AMOS / NS5 / Helm CONNECT parity).
 * Maps 1:1 to Excel import columns, PostgreSQL, Prisma, and API DTOs.
 */
export type MtilV2JobRecord = {
  // Identity & taxonomy
  engineeringJobCode: string;
  jobId: string;
  libraryVersion: string;
  machineryCode: string;
  machineryName: string;
  componentCode: string;
  componentName: string;
  subComponentCode: string | null;
  subComponentName: string | null;
  systemGroup: string;
  department: JobCatalogDepartment;
  action: MtilV2ComponentAction;
  workshop: string;

  // Applicability
  vesselApplicability: string[];
  projectApplicability: DryDockProjectType[];
  surveyApplicability: string[];

  // Scope & acceptance
  jobHeading: string;
  detailedScope: string;
  acceptanceCriteria: string;

  // Linked libraries
  templateId: string;
  inspectionChecklistId: string | null;
  measurementSetId: string | null;
  scopeOfWorkId: string | null;

  // Resources
  requiredTools: string[];
  requiredPpe: string[];
  requiredSpareParts: string[];
  requiredConsumables: string[];

  // Documentation
  requiredServiceReports: string[];
  requiredCertificates: string[];
  requiredPhotos: string[];
  beforeAfterImages: boolean;

  // Governance & hold points
  classHoldPoints: boolean;
  flagHoldPoints: boolean;
  ownerApprovalRequired: boolean;
  yardApprovalRequired: boolean;
  makerAttendanceRequired: boolean;
  permitRequired: string[];

  // Commercial
  rfqCategory: string;
  budgetCategory: string;
  costCode: string;

  // Planning
  plannedManHours: number;
  estimatedDurationDays: number | null;
  responsibleDepartment: string;
  responsibleRole: string;
  reviewRole: string;
  approvalRole: string;
  workflowId: string;
  defaultPriority: DdJobPriority;
  riskLevel: DdRiskLevel;

  // Technical mapping (normalized DB layer)
  sqlTableMapping: string;
  prismaModelMapping: string;
  apiResourceMapping: string;

  activeFlag: boolean;
  remarks: string | null;
};

/** Reusable dynamic template — production CMMS form engine. */
export type MtilV2TemplateRecord = {
  templateId: string;
  templateName: string;
  libraryVersion: string;
  category: string;

  // Auto-fill
  autoMachineryInformation: boolean;
  autoRunningHours: boolean;
  autoLastOverhaulDate: boolean;
  autoPreviousDryDockReference: boolean;
  autoVesselParticulars: boolean;

  // Attachments
  imageAttachments: string[];
  pdfAttachments: string[];
  calibrationCertificates: boolean;
  ndtReports: boolean;
  classReports: boolean;
  thicknessReports: boolean;
  pressureTestReports: boolean;
  beforeAfterComparison: boolean;

  // Workflow & audit
  digitalSignatures: boolean;
  approvalWorkflow: string[];
  revisionHistory: boolean;
  auditLog: boolean;

  measurementSetId: string | null;
  checklistId: string | null;
  activeFlag: boolean;
};

export type MtilV2DomainProgress = MtilV2DomainRelease & {
  actualJobCount: number;
  actualTemplateCount: number;
  actualMeasurementCount: number;
  actualChecklistItemCount: number;
  actualSpareMappingCount: number;
  actualRfqMappingCount: number;
  percentJobsComplete: number;
  r0BaselineJobCount: number;
};

export type MtilV2ProgressReport = {
  engineVersion: string;
  libraryVersion: string;
  r0FrameworkComplete: boolean;
  databaseTargets: typeof import("./standards").MTIL_V2_DATABASE_TARGETS;
  deliverables: string[];
  domains: MtilV2DomainProgress[];
  totals: {
    targetJobsMin: number;
    targetJobsMax: number;
    actualJobs: number;
    actualTemplates: number;
    actualMeasurements: number;
    actualChecklistItems: number;
    actualSpareMappings: number;
    actualRfqMappings: number;
    percentJobsToTargetMin: number;
  };
};
