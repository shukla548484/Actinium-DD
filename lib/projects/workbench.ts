import type { DryDockProjectStatus, ProjectStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { buildUserScope, projectScopeWhere } from "@/lib/rbac/scopeRules";
import { getStatusLabel } from "@/lib/superintendent/engine/statusWorkflow";
import {
  dryDockProjectScopeWhere,
  getScopedVesselIds,
} from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";

export const RECENT_COMPLETED_DAYS = 90;
export const RECENT_COMPLETED_LIMIT = 12;

const TERMINAL_STATUSES: DryDockProjectStatus[] = [
  "completed",
  "closed",
  "archived",
  "cancelled",
];

const RECENT_ELIGIBLE: DryDockProjectStatus[] = ["completed", "closed"];

const EXECUTION_STATUSES: DryDockProjectStatus[] = [
  "docking",
  "execution",
  "in_progress",
  "sea_trial",
  "final_inspection",
  "mobilization",
];

export type WorkbenchReviewStatus =
  | "in_progress"
  | "review_pending"
  | "review_complete"
  | "archived"
  | "on_hold"
  | "cancelled";

export type WorkbenchProjectCard = {
  id: string;
  name: string;
  referenceCode: string | null;
  status: DryDockProjectStatus;
  statusLabel: string;
  progressPct: number;
  currency: string;
  budgetTotal: number | null;
  approvedBudget: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
  budgetVariancePct: number | null;
  overBudget: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualEnd: string | null;
  expectedSailing: string | null;
  selectedYard: string | null;
  projectOwner: string | null;
  pendingApprovals: number;
  reviewStatus: WorkbenchReviewStatus;
  reviewStatusLabel: string;
  vessel: { id: string; name: string; code: string };
  tenderProjectId: string | null;
  href: string;
  tenderHref: string | null;
};

export type WorkbenchTenderCard = {
  id: string;
  name: string;
  referenceCode: string | null;
  status: ProjectStatus;
  statusLabel: string;
  vesselName: string | null;
  currency: string;
  updatedAt: string;
  href: string;
};

export type ProjectsWorkbenchDto = {
  active: WorkbenchProjectCard[];
  recentlyCompleted: WorkbenchProjectCard[];
  tenders: WorkbenchTenderCard[];
  kpis: {
    activeCount: number;
    inExecutionCount: number;
    overBudgetCount: number;
    pendingApprovalsCount: number;
    recentlyCompletedCount: number;
    openTendersCount: number;
  };
  meta: {
    recentDays: number;
    scoped: boolean;
  };
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function isActiveDryDockStatus(status: DryDockProjectStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export function resolveReviewStatus(
  status: DryDockProjectStatus,
): { reviewStatus: WorkbenchReviewStatus; reviewStatusLabel: string } {
  switch (status) {
    case "completed":
      return { reviewStatus: "review_pending", reviewStatusLabel: "Review pending" };
    case "closed":
      return { reviewStatus: "review_complete", reviewStatusLabel: "Review complete" };
    case "archived":
      return { reviewStatus: "archived", reviewStatusLabel: "Archived" };
    case "on_hold":
      return { reviewStatus: "on_hold", reviewStatusLabel: "On hold" };
    case "cancelled":
      return { reviewStatus: "cancelled", reviewStatusLabel: "Cancelled" };
    default:
      return { reviewStatus: "in_progress", reviewStatusLabel: "In progress" };
  }
}

export function budgetSnapshot(input: {
  approvedBudget: number | null;
  budgetTotal: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
}): { baseline: number | null; spent: number | null; variancePct: number | null; overBudget: boolean } {
  const baseline = input.approvedBudget ?? input.budgetTotal;
  const spent = input.actualTotal ?? input.quotedTotal;
  if (baseline == null || baseline <= 0 || spent == null) {
    return { baseline, spent, variancePct: null, overBudget: false };
  }
  const variancePct = ((spent - baseline) / baseline) * 100;
  return {
    baseline,
    spent,
    variancePct,
    overBudget: spent > baseline,
  };
}

const TENDER_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  tendering: "Tendering",
  comparing: "Comparing",
  closed: "Closed",
};

type DdRow = {
  id: string;
  name: string;
  referenceCode: string | null;
  status: DryDockProjectStatus;
  progressPct: number | null;
  currency: string | null;
  budgetTotal: number | null;
  approvedBudget: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualEnd: Date | null;
  expectedSailing: Date | null;
  selectedYard: string | null;
  projectOwner: string | null;
  updatedAt: Date;
  projectId: string | null;
  vessel: { id: string; name: string; code: string };
  _count: { approvals: number };
};

function mapDryDockCard(row: DdRow): WorkbenchProjectCard {
  const money = budgetSnapshot({
    approvedBudget: row.approvedBudget,
    budgetTotal: row.budgetTotal,
    quotedTotal: row.quotedTotal,
    actualTotal: row.actualTotal,
  });
  const review = resolveReviewStatus(row.status);

  return {
    id: row.id,
    name: row.name,
    referenceCode: row.referenceCode,
    status: row.status,
    statusLabel: getStatusLabel(row.status),
    progressPct: row.progressPct ?? 0,
    currency: row.currency ?? "USD",
    budgetTotal: row.budgetTotal,
    approvedBudget: row.approvedBudget,
    quotedTotal: row.quotedTotal,
    actualTotal: row.actualTotal,
    budgetVariancePct: money.variancePct,
    overBudget: money.overBudget,
    plannedStart: iso(row.plannedStart),
    plannedEnd: iso(row.plannedEnd),
    actualEnd: iso(row.actualEnd),
    expectedSailing: iso(row.expectedSailing),
    selectedYard: row.selectedYard,
    projectOwner: row.projectOwner,
    pendingApprovals: row._count.approvals,
    reviewStatus: review.reviewStatus,
    reviewStatusLabel: review.reviewStatusLabel,
    vessel: row.vessel,
    tenderProjectId: row.projectId,
    href: `/superintendent/projects/${row.id}`,
    tenderHref: row.projectId ? `/projects/${row.projectId}` : null,
  };
}

function sortActive(a: WorkbenchProjectCard, b: WorkbenchProjectCard): number {
  const aSail = a.expectedSailing ? new Date(a.expectedSailing).getTime() : Number.POSITIVE_INFINITY;
  const bSail = b.expectedSailing ? new Date(b.expectedSailing).getTime() : Number.POSITIVE_INFINITY;
  if (aSail !== bSail) return aSail - bSail;
  return a.name.localeCompare(b.name);
}

function recentSortKey(row: DdRow): number {
  return (row.actualEnd ?? row.updatedAt).getTime();
}

/** Scoped dry-dock workbench for the Job Creations home page. */
export async function getProjectsWorkbench(): Promise<ProjectsWorkbenchDto> {
  const userId = await getSessionUserId();
  if (!userId) {
    return emptyWorkbench(false);
  }

  const [scope, vesselIds] = await Promise.all([
    buildUserScope(userId),
    getScopedVesselIds(),
  ]);

  const scoped = vesselIds !== undefined;
  if (vesselIds?.length === 0 && !scope.unrestricted && scope.projectIds.length === 0) {
    return emptyWorkbench(true);
  }

  const recentSince = new Date();
  recentSince.setDate(recentSince.getDate() - RECENT_COMPLETED_DAYS);

  const ddWhere: Prisma.DryDockProjectWhereInput = {
    ...notDeleted,
    ...dryDockProjectScopeWhere(vesselIds),
  };

  const ddSelect = {
    id: true,
    name: true,
    referenceCode: true,
    status: true,
    progressPct: true,
    currency: true,
    budgetTotal: true,
    approvedBudget: true,
    quotedTotal: true,
    actualTotal: true,
    plannedStart: true,
    plannedEnd: true,
    actualEnd: true,
    expectedSailing: true,
    selectedYard: true,
    projectOwner: true,
    updatedAt: true,
    projectId: true,
    vessel: { select: { id: true, name: true, code: true } },
    _count: {
      select: {
        approvals: { where: { status: "pending" as const, ...notDeleted } },
      },
    },
  } satisfies Prisma.DryDockProjectSelect;

  const [activeRows, recentRows, tenderRows] = await Promise.all([
    prisma.dryDockProject.findMany({
      where: {
        ...ddWhere,
        status: { notIn: TERMINAL_STATUSES },
      },
      select: ddSelect,
      orderBy: [{ expectedSailing: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.dryDockProject.findMany({
      where: {
        ...ddWhere,
        status: { in: RECENT_ELIGIBLE },
        OR: [
          { actualEnd: { gte: recentSince } },
          { actualEnd: null, updatedAt: { gte: recentSince } },
        ],
      },
      select: ddSelect,
      orderBy: [{ actualEnd: "desc" }, { updatedAt: "desc" }],
      take: RECENT_COMPLETED_LIMIT,
    }),
    prisma.project.findMany({
      where: {
        ...notDeleted,
        ...projectScopeWhere(scope),
        status: { in: ["draft", "tendering", "comparing"] },
        dryDockProjects: { none: { ...notDeleted } },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        referenceCode: true,
        status: true,
        vesselName: true,
        currency: true,
        updatedAt: true,
      },
    }),
  ]);

  const active = activeRows.map(mapDryDockCard).sort(sortActive);
  const recentlyCompleted = [...recentRows]
    .sort((a, b) => recentSortKey(b) - recentSortKey(a))
    .map(mapDryDockCard);

  const tenders: WorkbenchTenderCard[] = tenderRows.map((t) => ({
    id: t.id,
    name: t.name,
    referenceCode: t.referenceCode,
    status: t.status,
    statusLabel: TENDER_STATUS_LABEL[t.status],
    vesselName: t.vesselName,
    currency: t.currency,
    updatedAt: t.updatedAt.toISOString(),
    href: `/projects/${t.id}`,
  }));

  const inExecutionCount = active.filter((p) =>
    EXECUTION_STATUSES.includes(p.status),
  ).length;
  const overBudgetCount = active.filter((p) => p.overBudget).length;
  const pendingApprovalsCount = active.reduce((sum, p) => sum + p.pendingApprovals, 0);

  return {
    active,
    recentlyCompleted,
    tenders,
    kpis: {
      activeCount: active.length,
      inExecutionCount,
      overBudgetCount,
      pendingApprovalsCount,
      recentlyCompletedCount: recentlyCompleted.length,
      openTendersCount: tenders.length,
    },
    meta: {
      recentDays: RECENT_COMPLETED_DAYS,
      scoped,
    },
  };
}

function emptyWorkbench(scoped: boolean): ProjectsWorkbenchDto {
  return {
    active: [],
    recentlyCompleted: [],
    tenders: [],
    kpis: {
      activeCount: 0,
      inExecutionCount: 0,
      overBudgetCount: 0,
      pendingApprovalsCount: 0,
      recentlyCompletedCount: 0,
      openTendersCount: 0,
    },
    meta: { recentDays: RECENT_COMPLETED_DAYS, scoped },
  };
}
