import prisma from "@/lib/prisma";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import { getSessionPrincipalFromRequest } from "@/lib/session";
import {
  RequisitionStatus,
  GenerationStatus,
  CREW_REQUISITION_CREATOR_MIN_ACCESS,
  CREW_REQUISITION_CREATOR_MAX_ACCESS,
} from "@/lib/types/requisition";
import { isCrewOriginatedRequisitionNumber } from "@/lib/sync/record-origin-suffix";

/** Statuses visible after a requisition leaves the initial NOT_READY / NEW_REQ stage. */
export const REQUISITION_POST_SUBMIT_STATUSES: RequisitionStatus[] = [
  RequisitionStatus.NEW_REQ,
  RequisitionStatus.REQ_APPROVED,
  RequisitionStatus.SENT_FOR_QUOTE,
  RequisitionStatus.QUOTE_RECEIVED,
  RequisitionStatus.PARTIAL_QUOTE_RECEIVED,
  RequisitionStatus.QUOTE_APPROVED,
  RequisitionStatus.QUOTE_CONFIRMED_PO_SENT,
  RequisitionStatus.SPLIT,
  RequisitionStatus.REQ_RECEIVED_DELIVERED,
  RequisitionStatus.REQ_RETURNED,
  RequisitionStatus.INVOICE_RECEIVED,
];

/** Vessel crew access range (6–25) used for peer draft visibility rules. */
export const VESSEL_CREW_ACCESS_MIN = 6;
export const VESSEL_CREW_ACCESS_MAX = CREW_REQUISITION_CREATOR_MAX_ACCESS;

/** Shore roles that may see submitted V.* NOT_READY in lists (office approval queue). */
export const OFFICE_NOT_READY_V_PREFIX_MIN_ACCESS = 39;

type RequisitionWhere = Record<string, unknown>;

function ownNotReadyOrDraft(viewerId: string | undefined): RequisitionWhere | null {
  if (!viewerId) return null;
  return {
    AND: [{ status: RequisitionStatus.NOT_READY }, { createdById: viewerId }],
  };
}

/** Submitted crew requisitions (V.* / T.*) awaiting Master approval — not save-as-draft. */
function peerCrewNotReadyForMasterApproval(viewerId: string | undefined): RequisitionWhere {
  const parts: RequisitionWhere[] = [
    { status: RequisitionStatus.NOT_READY },
    { generationStatus: GenerationStatus.CREATED },
    {
      OR: [
        { requisitionNumber: { startsWith: "V.", mode: "insensitive" } },
        { requisitionNumber: { startsWith: "T.", mode: "insensitive" } },
      ],
    },
    {
      createdBy: {
        designationAccessLevel: {
          gte: VESSEL_CREW_ACCESS_MIN,
          lte: CREW_REQUISITION_CREATOR_MAX_ACCESS,
        },
      },
    },
  ];
  if (viewerId) {
    parts.push({ createdById: { not: viewerId } });
  }
  return { AND: parts };
}

function submittedNotReadyWithPrefix(prefix: "V." | "O."): RequisitionWhere {
  return {
    AND: [
      { status: RequisitionStatus.NOT_READY },
      { generationStatus: GenerationStatus.CREATED },
      { requisitionNumber: { startsWith: prefix, mode: "insensitive" } },
    ],
  };
}

export type RequisitionListViewer = {
  viewerId?: string;
  viewerAccessLevel?: number;
};

export type RequisitionVisibilityRow = {
  status: RequisitionStatus;
  generationStatus: GenerationStatus;
  requisitionNumber: string;
  createdById: string;
  createdBy?: { designationAccessLevel?: number | null };
};

/** Row-level check matching {@link appendRequisitionAccessLevelFilter} list rules. */
export function isRequisitionVisibleToViewer(
  requisition: RequisitionVisibilityRow,
  viewer: RequisitionListViewer
): boolean {
  const { viewerId, viewerAccessLevel } = viewer;
  if (viewerAccessLevel === undefined) return false;

  const { status, generationStatus, requisitionNumber, createdById } = requisition;
  const creatorLevel = requisition.createdBy?.designationAccessLevel ?? null;
  const isOwn = Boolean(viewerId && createdById === viewerId);
  const num = requisitionNumber.trim().toUpperCase();
  const isCrewReq = isCrewOriginatedRequisitionNumber(requisitionNumber);
  const isO = num.startsWith("O.");
  const isSubmitted = generationStatus === GenerationStatus.CREATED;

  if (isAdminEquivalentAccessLevel(viewerAccessLevel)) {
    return true;
  }

  if (REQUISITION_POST_SUBMIT_STATUSES.includes(status)) {
    if (viewerAccessLevel === 25) {
      return status === RequisitionStatus.NEW_REQ || status === RequisitionStatus.REQ_APPROVED;
    }
    if (viewerAccessLevel >= 26 && viewerAccessLevel <= 48) {
      return true;
    }
    if (
      viewerAccessLevel >= VESSEL_CREW_ACCESS_MIN &&
      viewerAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
    ) {
      return status === RequisitionStatus.NEW_REQ || status === RequisitionStatus.REQ_APPROVED;
    }
    return false;
  }

  if (status !== RequisitionStatus.NOT_READY) {
    return false;
  }

  if (
    viewerAccessLevel >= VESSEL_CREW_ACCESS_MIN &&
    viewerAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS &&
    viewerAccessLevel !== 25
  ) {
    return isOwn;
  }

  if (viewerAccessLevel === 25) {
    if (isOwn) return true;
    return (
      isSubmitted &&
      isCrewReq &&
      creatorLevel != null &&
      creatorLevel >= VESSEL_CREW_ACCESS_MIN &&
      creatorLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
    );
  }

  if (viewerAccessLevel >= 26 && viewerAccessLevel <= 48) {
    if (!isSubmitted) return false;
    if (isO) return true;
    if (isCrewReq && viewerAccessLevel >= OFFICE_NOT_READY_V_PREFIX_MIN_ACCESS) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Applies access-level visibility rules to a requisition list/stats where clause.
 * Mutates `where` in place (same behavior as list + stats API routes).
 *
 * Draft / NOT_READY from vessel crew (access 6–25) are visible only to the creator,
 * except Master (25) may see submitted V.* NOT_READY (CREATED) for approval, and
 * office roles (39+) may see submitted V.* / O.* NOT_READY for shore approval.
 */
export function appendRequisitionAccessLevelFilter(
  where: RequisitionWhere,
  viewer: RequisitionListViewer | number | undefined
): void {
  const normalized: RequisitionListViewer =
    typeof viewer === "number" ? { viewerAccessLevel: viewer } : viewer ?? {};
  const { viewerId, viewerAccessLevel } = normalized;
  if (viewerAccessLevel === undefined) return;

  const accessAndParts: RequisitionWhere[] = [];
  const postSubmit = { status: { in: REQUISITION_POST_SUBMIT_STATUSES } };
  const ownDraft = ownNotReadyOrDraft(viewerId);

  if (isAdminEquivalentAccessLevel(viewerAccessLevel)) {
    accessAndParts.push({
      status: {
        in: [RequisitionStatus.NOT_READY, ...REQUISITION_POST_SUBMIT_STATUSES],
      },
    });
  } else if (viewerAccessLevel === 25) {
    const orParts: RequisitionWhere[] = [postSubmit];
    if (ownDraft) orParts.push(ownDraft);
    orParts.push(peerCrewNotReadyForMasterApproval(viewerId));
    accessAndParts.push({ OR: orParts });
  } else if (viewerAccessLevel >= 26 && viewerAccessLevel <= 48) {
    const orParts: RequisitionWhere[] = [postSubmit, submittedNotReadyWithPrefix("O.")];
    if (viewerAccessLevel >= OFFICE_NOT_READY_V_PREFIX_MIN_ACCESS) {
      orParts.push(submittedNotReadyWithPrefix("V."));
      orParts.push(submittedNotReadyWithPrefix("T."));
    }
    accessAndParts.push({ OR: orParts });
  } else if (
    viewerAccessLevel >= VESSEL_CREW_ACCESS_MIN &&
    viewerAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
  ) {
    const orParts: RequisitionWhere[] = [
      { status: { in: [RequisitionStatus.NEW_REQ, RequisitionStatus.REQ_APPROVED] } },
    ];
    if (ownDraft) orParts.push(ownDraft);
    accessAndParts.push({ OR: orParts });
  }

  if (accessAndParts.length > 0) {
    where.AND = [...((where.AND as RequisitionWhere[]) || []), ...accessAndParts];
  } else {
    where.id = "impossible-id-to-match-nothing";
  }
}

export type RequisitionViewer = RequisitionListViewer;

/**
 * Resolves viewer id + access level for list/stats APIs.
 * Uses lightweight session auth; optional viewerId query param keeps backward compatibility.
 */
export async function resolveRequisitionViewer(
  request: Request,
  viewerIdFromQuery?: string | null
): Promise<RequisitionViewer> {
  let viewerId = viewerIdFromQuery?.trim() || undefined;
  let viewerAccessLevel: number | undefined;

  if (!viewerId) {
    const principal = await getSessionPrincipalFromRequest(request);
    if (principal) {
      viewerId = principal.userId;
      viewerAccessLevel = principal.designationAccessLevel ?? undefined;
    }
  } else {
    try {
      const viewer = await prisma.employee.findUnique({
        where: { id: viewerId },
        select: { designationAccessLevel: true },
      });
      viewerAccessLevel = viewer?.designationAccessLevel ?? undefined;
    } catch {
      // Continue without access level — will show limited results
    }
  }

  return { viewerId, viewerAccessLevel };
}
