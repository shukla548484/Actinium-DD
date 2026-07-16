import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  appendRequisitionAccessLevelFilter,
  resolveRequisitionViewer,
} from "@/lib/requisition-list-access";
import { GenerationStatus, RequisitionStatus } from "@/lib/types/requisition";

export const dynamic = "force-dynamic";

const EMPTY_STATS = {
  total: 0,
  drafts: 0,
  created: 0,
  approved: 0,
  inProcess: 0,
  completed: 0,
  pendingApproval: 0,
};

/**
 * GET /api/requisitions/stats
 * Returns counts only (no requisition rows) for the view-requisitions dashboard.
 * Same filters as list API (vesselId, visibility by access level). Fast.
 */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const { viewerId, viewerAccessLevel } = await resolveRequisitionViewer(request);

    const where: Record<string, unknown> = { deletedAt: null };
    appendRequisitionAccessLevelFilter(where, { viewerId, viewerAccessLevel });

    if (vesselId) {
      const vesselIds = vesselId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 50);
      if (vesselIds.length === 1) {
        where.vesselId = vesselIds[0];
      } else if (vesselIds.length > 1) {
        where.vesselId = { in: vesselIds };
      }
    }

    if (dateFrom || dateTo) {
      where.dateOfCreation = {};
      if (dateFrom) (where.dateOfCreation as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.dateOfCreation as Record<string, Date>).lte = new Date(dateTo);
    }

    const inProcessStatuses = [
      RequisitionStatus.SENT_FOR_QUOTE,
      RequisitionStatus.QUOTE_RECEIVED,
      RequisitionStatus.PARTIAL_QUOTE_RECEIVED,
      RequisitionStatus.QUOTE_APPROVED,
      RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
    ];

    const grouped = await prisma.requisition.groupBy({
      by: ["generationStatus", "status"],
      where,
      _count: { _all: true },
    });

    let total = 0;
    let drafts = 0;
    let created = 0;
    let approved = 0;
    let inProcess = 0;
    let completed = 0;

    for (const row of grouped) {
      const count = row._count._all;
      total += count;
      if (row.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
        drafts += count;
      }
      if (
        row.generationStatus === GenerationStatus.CREATED &&
        row.status === RequisitionStatus.NOT_READY
      ) {
        created += count;
      }
      if (row.status === RequisitionStatus.REQ_APPROVED) {
        approved += count;
      }
      if (inProcessStatuses.includes(row.status as RequisitionStatus)) {
        inProcess += count;
      }
      if (row.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
        completed += count;
      }
    }

    const pendingApproval = created;

    return NextResponse.json(
      {
        total,
        drafts,
        created,
        approved,
        inProcess,
        completed,
        pendingApproval,
      },
      {
        headers: {
          "X-Response-Time-Ms": String(Date.now() - started),
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching requisition stats:", error);
    return NextResponse.json(EMPTY_STATS, { status: 500 });
  }
}
