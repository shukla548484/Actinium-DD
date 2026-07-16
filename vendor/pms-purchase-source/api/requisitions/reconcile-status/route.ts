import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  applyRequisitionStatusFix,
  reconcileRequisitionStatus,
  type RequisitionReconcileInput,
} from "@/lib/procurement/requisition-status-reconcile";
import { RequisitionStatus } from "@/lib/types/requisition";

/**
 * POST /api/requisitions/reconcile-status
 * Admin-only: fix requisition header statuses from quotes / PO / history.
 * Body: { dryRun?: boolean } — default true (report only).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const level = user.designationAccessLevel ?? 0;
    if (!isAdminEquivalentAccessLevel(level)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;

    const requisitions = await prisma.requisition.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        requisitionNumber: true,
        status: true,
        vendorQuotes: {
          select: {
            status: true,
            quotedItems: { select: { unitPrice: true, totalPrice: true } },
          },
        },
        purchaseOrders: { select: { status: true } },
        purchaseHistory: {
          select: { actionType: true, newStatus: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    const fixes = requisitions
      .map((req) => {
        const input: RequisitionReconcileInput = {
          id: req.id,
          requisitionNumber: req.requisitionNumber,
          status: req.status,
          vendorQuotes: req.vendorQuotes,
          purchaseOrders: req.purchaseOrders,
          purchaseHistory: req.purchaseHistory,
        };
        return reconcileRequisitionStatus(input);
      })
      .filter(Boolean);

    if (!dryRun) {
      for (const fix of fixes) {
        if (!fix) continue;
        await applyRequisitionStatusFix(
          prisma,
          fix.requisitionId,
          fix.expectedStatus as RequisitionStatus
        );
      }
    }

    return NextResponse.json({
      dryRun,
      totalChecked: requisitions.length,
      issuesFound: fixes.length,
      fixed: dryRun ? 0 : fixes.length,
      fixes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reconcile failed";
    console.error("reconcile-status:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
