export type YardWorkProjectStatus = "planning" | "execution" | "completed" | "on_hold";

export type WorkshopJobStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "blocked"
  | "awaiting_owner"
  | "awaiting_class"
  | "awaiting_material";

export type JobPriority = "critical" | "high" | "normal" | "low";

export type VesselArea = "ER" | "Deck" | "Tank" | "Hull" | "Cargo hold" | "Other";

export interface YardWorkProject {
  id: string;
  projectId: string;
  yardCompanyId: string | null;
  status: YardWorkProjectStatus;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  projectName?: string;
  vesselName?: string | null;
}

export interface WorkshopJob {
  id: string;
  yardWorkProjectId: string;
  workshopSlug: string;
  jobCode: string | null;
  jobTitle: string;
  vesselArea: string | null;
  priority: JobPriority;
  status: WorkshopJobStatus;
  plannedStart: string | null;
  plannedFinish: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  progressPct: number;
  manpowerRequired: number | null;
  equipmentRequired: string | null;
  materialRequired: string | null;
  permitRequired: string | null;
  classHoldPoint: boolean;
  ownerApprovalRequired: boolean;
  blockingDependency: string | null;
  delayReason: string | null;
  remarks: string | null;
  isCriticalPath: boolean;
  isVariation: boolean;
  specLineId: string | null;
}

export interface WorkshopJobRecord extends WorkshopJob {
  workshopName: string;
  predecessorIds: string[];
  successorIds: string[];
}

export interface WorkshopJobDependency {
  id: string;
  successorJobId: string;
  predecessorJobId: string;
  lagDays: number;
}

export interface ShipyardDashboardKpis {
  totalJobs: number;
  jobsNotStarted: number;
  jobsInProgress: number;
  jobsCompleted: number;
  criticalPathJobs: number;
  delayedJobs: number;
  awaitingOwnerApproval: number;
  awaitingClassInspection: number;
  awaitingMaterial: number;
  awaitingAccessStaging: number;
  variationJobs: number;
  plannedVsActualPct: { planned: number; actual: number };
  budgetedVsWorkDone: { budgeted: number; workDone: number };
  activeProjects?: number;
}

export const JOB_STATUS_LABELS: Record<WorkshopJobStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
  awaiting_owner: "Awaiting owner",
  awaiting_class: "Awaiting class",
  awaiting_material: "Awaiting material",
};

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  critical: "Critical",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const VESSEL_AREAS: VesselArea[] = ["ER", "Deck", "Tank", "Hull", "Cargo hold", "Other"];
