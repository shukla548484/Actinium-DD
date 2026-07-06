import { prisma } from "@/lib/prisma";
import { listSpecLines } from "@/lib/db/index";
import {
  resolveYardInviteWorkflowStage,
  type YardRfqPriority,
} from "@/lib/shipyard/rfqWorkflow";
import type { YardRfqWorkflowStage } from "@/lib/shipyard/workflow";

const notDeleted = { deletedAt: null };

export type ShipyardRfqQueueRow = {
  id: string;
  projectId: string;
  projectName: string;
  vesselName: string | null;
  yardName: string;
  token: string;
  inviteStatus: string;
  workflowStage: YardRfqWorkflowStage;
  rfqReference: string;
  priority: YardRfqPriority;
  dueDate: string | null;
  receivedAt: string;
  dockingWindow: string | null;
  assignedEstimatorId: string | null;
  assignedEstimatorName: string | null;
  submittedAt: string | null;
  createdAt: string;
  hasCostEstimate: boolean;
  estimateVersionCount: number;
};

export type ShipyardEstimatorOption = {
  id: string;
  label: string;
  designation: string | null;
};

function rfqReferenceFromInvite(id: string, createdAt: Date): string {
  const year = createdAt.getFullYear().toString().slice(-2);
  const seq = id.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `RFQ-${year}${seq}`;
}

function priorityFromRow(
  stored: string,
  projectStatus: string,
): ShipyardRfqQueueRow["priority"] {
  if (stored === "low" || stored === "normal" || stored === "high" || stored === "urgent") {
    return stored;
  }
  if (projectStatus === "tendering") return "high";
  if (projectStatus === "comparing") return "urgent";
  return "normal";
}

function dockingWindowLabel(shipyardDays: number | null, dryDockDays: number | null): string | null {
  if (!shipyardDays && !dryDockDays) return null;
  const parts: string[] = [];
  if (dryDockDays) parts.push(`${dryDockDays}d DD`);
  if (shipyardDays) parts.push(`${shipyardDays}d yard`);
  return parts.join(" · ");
}

function mapQueueRow(
  row: Awaited<ReturnType<typeof fetchRfqRows>>[number],
): ShipyardRfqQueueRow {
  const workflowStage = resolveYardInviteWorkflowStage(row);
  const estimator = row.assignedEstimator;
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    vesselName: row.project.vesselName,
    yardName: row.yardName,
    token: row.token,
    inviteStatus: row.status,
    workflowStage,
    rfqReference: rfqReferenceFromInvite(row.id, row.createdAt),
    priority: priorityFromRow(row.priority, row.project.status),
    dueDate: row.dueDate?.toISOString() ?? null,
    receivedAt: row.createdAt.toISOString(),
    dockingWindow: dockingWindowLabel(row.project.shipyardDays, row.project.dryDockDays),
    assignedEstimatorId: row.assignedEstimatorId,
    assignedEstimatorName: estimator
      ? `${estimator.firstName} ${estimator.lastName}`.trim()
      : null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    hasCostEstimate: row.costEstimates.length > 0,
    estimateVersionCount: row.costEstimates.length,
  };
}

async function fetchRfqRows() {
  return prisma.yardInvite.findMany({
    where: notDeleted,
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    include: {
      assignedEstimator: {
        select: { id: true, firstName: true, lastName: true },
      },
      costEstimates: { select: { id: true } },
      project: {
        select: {
          id: true,
          name: true,
          vesselName: true,
          status: true,
          shipyardDays: true,
          dryDockDays: true,
          deletedAt: true,
        },
      },
    },
  });
}

/** RFQ queue — office YardInvite rows with shipyard workflow metadata. */
export async function listShipyardRfqQueue(): Promise<ShipyardRfqQueueRow[]> {
  const rows = await fetchRfqRows();
  return rows
    .filter((row) => row.project && !row.project.deletedAt)
    .map(mapQueueRow);
}

export async function getShipyardRfqQueueRow(inviteId: string): Promise<ShipyardRfqQueueRow | null> {
  const row = await prisma.yardInvite.findFirst({
    where: { id: inviteId, ...notDeleted },
    include: {
      assignedEstimator: {
        select: { id: true, firstName: true, lastName: true },
      },
      costEstimates: { select: { id: true } },
      project: {
        select: {
          id: true,
          name: true,
          vesselName: true,
          status: true,
          shipyardDays: true,
          dryDockDays: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!row || !row.project || row.project.deletedAt) return null;
  return mapQueueRow(row);
}

export type YardInvitePatchInput = {
  workflowStage?: YardRfqWorkflowStage;
  priority?: YardRfqPriority;
  dueDate?: string | null;
  assignedEstimatorId?: string | null;
  yardCompanyId?: string | null;
};

export async function patchShipyardRfqInvite(
  inviteId: string,
  input: YardInvitePatchInput,
): Promise<ShipyardRfqQueueRow | null> {
  const existing = await prisma.yardInvite.findFirst({
    where: { id: inviteId, ...notDeleted },
  });
  if (!existing) return null;

  await prisma.yardInvite.update({
    where: { id: inviteId },
    data: {
      workflowStage: input.workflowStage,
      priority: input.priority,
      dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
      assignedEstimatorId: input.assignedEstimatorId,
      yardCompanyId: input.yardCompanyId,
      updatedAt: new Date(),
    },
  });

  return getShipyardRfqQueueRow(inviteId);
}

export async function listShipyardEstimators(): Promise<ShipyardEstimatorOption[]> {
  const rows = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      company: { category: "shipyard", deletedAt: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      designation: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });

  return rows.map((e) => ({
    id: e.id,
    label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
    designation: e.designation,
  }));
}

export async function getShipyardRfqInviteContext(inviteId: string) {
  const invite = await prisma.yardInvite.findFirst({
    where: { id: inviteId, ...notDeleted },
    include: {
      project: true,
      assignedEstimator: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  if (!invite || invite.project.deletedAt) return null;

  const specLines = await listSpecLines(invite.projectId);
  return {
    invite,
    project: invite.project,
    specLines,
    workflowStage: resolveYardInviteWorkflowStage(invite),
  };
}
