import type {
  DdApprovalStatus,
  DdInputResponsibleRole,
  DdJobPriority,
  DdJobStatus,
  DdRiskLevel,
  DdSparesStatus,
  DdSurveyStatus,
  DdVesselJobSource,
  DdVesselJobStatus,
  DryDockProjectPriority,
  DryDockProjectStatus,
  DryDockProjectType,
  EntityStatus,
} from "@prisma/client";

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string | "all";
  vesselId?: string;
  dryDockProjectId?: string;
  employeeId?: string;
  vesselIds?: string[];
  category?: string;
}

export type PaginatedResult<TItemsKey extends string, TItem> = Record<TItemsKey, TItem[]> & {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type VesselTechnicalProfileDto = {
  id: string;
  vesselId: string;
  classNotation: string | null;
  mainEngine: string | null;
  auxiliaryEngine: string | null;
  boilerInfo: string | null;
  defectSummary: string | null;
  pmsSummary: string | null;
  sparesSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperintendentVesselDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
  status: EntityStatus;
  nextDryDockDue: string | null;
  lastDryDockDate: string | null;
  classSociety: string | null;
  readinessScore: number | null;
  dryDockProjectCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type VesselOverviewDto = SuperintendentVesselDto & {
  technicalProfile: VesselTechnicalProfileDto | null;
  projectCount: number;
};

export type DryDockProjectDto = {
  id: string;
  vesselId: string;
  vesselName: string;
  projectId: string | null;
  name: string;
  referenceCode: string | null;
  projectType: DryDockProjectType;
  priority: DryDockProjectPriority;
  status: DryDockProjectStatus;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  selectedYard: string | null;
  budgetTotal: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
  progressPct: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdJobDto = {
  id: string;
  dryDockProjectId: string;
  jobCode: string | null;
  title: string;
  category: string;
  description: string | null;
  workshop: string | null;
  priority: DdJobPriority;
  status: DdJobStatus;
  progressPct: number | null;
  budgetAmount: number | null;
  quotedAmount: number | null;
  actualAmount: number | null;
  responsibleParty: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DdVesselJobDto = {
  id: string;
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  targetDryDockProjectId: string | null;
  integratedDryDockProjectId: string | null;
  integratedDdJobId: string | null;
  jobCode: string | null;
  title: string;
  category: string;
  workshop: string | null;
  description: string | null;
  priority: DdJobPriority;
  source: DdVesselJobSource;
  status: DdVesselJobStatus;
  createdByName: string | null;
  createdByRole: DdInputResponsibleRole | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  integratedAt: string | null;
  integratedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  carryForwardReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdBudgetLineDto = {
  id: string;
  dryDockProjectId: string;
  category: string;
  description: string | null;
  budgetAmount: number;
  quotedAmount: number | null;
  approvedAmount: number | null;
  actualAmount: number | null;
  responsibleParty: string | null;
  varianceReason: string | null;
  approvalStatus: DdApprovalStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DdChecklistItemDto = {
  id: string;
  dryDockProjectId: string;
  title: string;
  category: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  completedAt: string | null;
  assignedTo: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DdMilestoneDto = {
  id: string;
  dryDockProjectId: string;
  title: string;
  plannedDate: string | null;
  baselineDate: string | null;
  actualDate: string | null;
  status: string;
  notes: string | null;
  dependsOnMilestoneId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DdPurchaseOrderDto = {
  id: string;
  dryDockProjectId: string;
  poNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: import("@prisma/client").DdPoStatus;
  orderedDate: string | null;
  expectedDelivery: string | null;
  deliveredDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdResourceAllocationDto = {
  id: string;
  dryDockProjectId: string;
  title: string;
  resourceType: import("@prisma/client").DdResourceType;
  quantity: number;
  unit: string | null;
  status: import("@prisma/client").DdResourceStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdRiskItemDto = {
  id: string;
  dryDockProjectId: string;
  title: string;
  description: string | null;
  likelihood: DdRiskLevel;
  impact: DdRiskLevel;
  mitigation: string | null;
  owner: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DdVariationOrderDto = {
  id: string;
  dryDockProjectId: string;
  voNumber: string | null;
  title: string;
  description: string | null;
  amount: number;
  approvalStatus: DdApprovalStatus;
  requestedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdDailyReportDto = {
  id: string;
  dryDockProjectId: string;
  reportDate: string;
  completedWork: string | null;
  plannedWork: string | null;
  manpowerCount: number | null;
  safetyNotes: string | null;
  delayNotes: string | null;
  progressPct: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DdDelayItemDto = {
  id: string;
  dryDockProjectId: string;
  title: string;
  reason: string | null;
  impactDays: number | null;
  responsibleParty: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DdSurveyItemDto = {
  id: string;
  dryDockProjectId: string;
  surveyType: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: DdSurveyStatus;
  classReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdSparesItemDto = {
  id: string;
  dryDockProjectId: string;
  partName: string;
  partNumber: string | null;
  quantity: number;
  supplyType: string;
  status: DdSparesStatus;
  requiredDate: string | null;
  deliveredDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DdApprovalRequestDto = {
  id: string;
  dryDockProjectId: string;
  approvalType: string;
  title: string;
  description: string | null;
  amount: number | null;
  status: DdApprovalStatus;
  requestedBy: string | null;
  approvedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardStatsDto = {
  vesselCount: number;
  projectCount: number;
  activeProjectCount: number;
  jobCount: number;
  openDefectCount: number;
  pendingApprovalCount: number;
  openRiskCount: number;
  openDelayCount: number;
  pendingSurveyCount: number;
  pendingSparesCount: number;
};
