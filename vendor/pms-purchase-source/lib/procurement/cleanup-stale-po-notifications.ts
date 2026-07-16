import prisma from "@/lib/prisma";
import { getPoApprovalPolicy } from "@/lib/services/po-approval-policy.service";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";
import {
  resolveWorkflowStatusAfterApproval,
} from "@/lib/services/po-workflow-status.service";

const PO_TASK_OPERATIONS = ["PO_APPROVAL_PENDING", "PO_READY_TO_SEND"] as const;

export type StalePoNotificationRow = {
  notificationId: string;
  operation: string;
  userLabel: string;
  poId: string | null;
  poNumber: string | null;
  workflowStatus: string | null;
  totalAmount: number | null;
  reason: string;
};

export type CleanupStalePoNotificationsResult = {
  dryRun: boolean;
  staleFound: number;
  markedRead: number;
  rows: StalePoNotificationRow[];
};

function reasonForStaleTask(
  operation: string,
  po: {
    workflowStatus: string | null;
    status: string;
    totalAmount: unknown;
    levelOneApprovedAt: Date | null;
    levelTwoApprovedAt: Date | null;
    levelThreeApprovedAt: Date | null;
    requisition?: { vesselId: string | null; vessel?: { companyId: string | null } | null } | null;
  } | null,
  policyThreshold: number | null
): string | null {
  if (!po) return "PO record not found";

  const amount = po.totalAmount != null ? Number(po.totalAmount) : 0;
  const workflow =
    po.workflowStatus ??
    (po.requisition
      ? resolveWorkflowStatusAfterApproval(
          po,
          amount,
          {
            thresholdLevel2: policyThreshold ?? 3000,
            thresholdLevel3: 10000,
            level1AccessLevels: [37, 39, 50],
            level2AccessLevels: [41, 44, 50],
            level3AccessLevels: [46, 47, 48, 50],
            currency: "USD",
          }
        )
      : null);

  if (po.status === "CANCELLED" || workflow === PurchaseOrderWorkflowStatus.CANCELLED) {
    return "PO is cancelled";
  }

  if (workflow === PurchaseOrderWorkflowStatus.PO_SENT) {
    return "PO already sent to vendor";
  }

  if (operation === "PO_APPROVAL_PENDING") {
    if (workflow === PurchaseOrderWorkflowStatus.PO_CONFIRMED) {
      return "PO confirmed — tier approval no longer pending";
    }
    if (policyThreshold != null && amount < policyThreshold) {
      return `PO amount below approval threshold (${policyThreshold})`;
    }
  }

  if (operation === "PO_READY_TO_SEND") {
    if (workflow !== PurchaseOrderWorkflowStatus.PO_CONFIRMED) {
      return `PO workflow is ${workflow ?? "unknown"} — not ready to send`;
    }
  }

  return null;
}

export async function findStalePoApprovalNotifications(): Promise<StalePoNotificationRow[]> {
  const notifications = await prisma.operationNotification.findMany({
    where: {
      isRead: false,
      type: "TASK_ASSIGNED",
      operation: { in: [...PO_TASK_OPERATIONS] },
    },
    select: {
      id: true,
      operation: true,
      metadata: true,
      userId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const stale: StalePoNotificationRow[] = [];

  for (const n of notifications) {
    const meta = (n.metadata ?? {}) as Record<string, unknown>;
    const poId = typeof meta.poId === "string" ? meta.poId : null;

    let po: {
      id: string;
      poNumber: string;
      workflowStatus: string | null;
      status: string;
      totalAmount: unknown;
      levelOneApprovedAt: Date | null;
      levelTwoApprovedAt: Date | null;
      levelThreeApprovedAt: Date | null;
      requisition: {
        vesselId: string | null;
        vessel: { companyId: string | null } | null;
      } | null;
    } | null = null;

    let policyThreshold: number | null = null;

    if (poId) {
      po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        select: {
          id: true,
          poNumber: true,
          workflowStatus: true,
          status: true,
          totalAmount: true,
          levelOneApprovedAt: true,
          levelTwoApprovedAt: true,
          levelThreeApprovedAt: true,
          requisition: {
            select: {
              vesselId: true,
              vessel: { select: { companyId: true } },
            },
          },
        },
      });

      if (po?.requisition) {
        const policy = await getPoApprovalPolicy(
          po.requisition.vessel?.companyId ?? null,
          po.requisition.vesselId
        );
        policyThreshold = policy.thresholdLevel2;
      }
    }

    const reason = reasonForStaleTask(n.operation, po, policyThreshold);
    if (!reason) continue;

    let userLabel = "Unknown user";
    if (n.userId) {
      const user = await prisma.employee.findUnique({
        where: { id: n.userId },
        select: { firstName: true, lastName: true },
      });
      if (user) userLabel = `${user.firstName} ${user.lastName}`.trim();
    }

    stale.push({
      notificationId: n.id,
      operation: n.operation,
      userLabel,
      poId,
      poNumber: po?.poNumber ?? (typeof meta.poNumber === "string" ? meta.poNumber : null),
      workflowStatus: po?.workflowStatus ?? null,
      totalAmount: po?.totalAmount != null ? Number(po.totalAmount) : null,
      reason,
    });
  }

  return stale;
}

export async function cleanupStalePoApprovalNotifications(
  dryRun: boolean
): Promise<CleanupStalePoNotificationsResult> {
  const rows = await findStalePoApprovalNotifications();

  if (!dryRun && rows.length > 0) {
    await prisma.operationNotification.updateMany({
      where: { id: { in: rows.map((r) => r.notificationId) } },
      data: { isRead: true },
    });
  }

  return {
    dryRun,
    staleFound: rows.length,
    markedRead: dryRun ? 0 : rows.length,
    rows,
  };
}
