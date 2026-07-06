import type { ShipyardDashboardKpis } from "@/lib/shipyard/types";

export type ShipyardPortalTimelineItem = {
  projectId: string;
  projectName: string;
  vesselName: string | null;
  status: string;
  plannedStart: string | null;
  plannedFinish: string | null;
};

export type ShipyardPortalProjectProgress = {
  projectId: string;
  projectName: string;
  vesselName: string | null;
  status: string;
  progressPct: number;
  jobCount: number;
};

export type ShipyardPortalCriticalJob = {
  id: string;
  jobTitle: string;
  workshopSlug: string;
  workshopName: string;
  projectId: string;
  projectName: string;
  status: string;
  progressPct: number;
  plannedFinish: string | null;
};

export type ShipyardPortalDashboard = {
  currentProjects: number;
  projectsWaitingRfq: number;
  runningToday: number;
  delayedJobs: number;
  workersToday: number;
  equipmentUtilizationPct: number;
  executionKpis: ShipyardDashboardKpis;
  timeline: ShipyardPortalTimelineItem[];
  criticalJobsToday: ShipyardPortalCriticalJob[];
  projectProgress: ShipyardPortalProjectProgress[];
  variationSummary: { pending: number; approved: number; rejected: number };
  invoiceSummary: { pending: number; paid: number; overdue: number };
};
