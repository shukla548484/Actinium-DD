import {
  GenerationStatus,
  RequisitionStatus,
  RequisitionType,
  REQUISITION_STATUS_LABELS,
  REQUISITION_TYPE_LABELS,
  GENERATION_STATUS_LABELS,
} from "@/lib/types/requisition";

/** Shared badge chrome — soft fill + readable text + border (distinct per enum). */
const BADGE_BASE =
  "inline-flex items-center font-medium border whitespace-nowrap";

export const REQUISITION_STATUS_BADGE_CLASS: Record<RequisitionStatus, string> = {
  [RequisitionStatus.NOT_READY]:
    `${BADGE_BASE} bg-slate-100 text-slate-800 border-slate-300`,
  [RequisitionStatus.NEW_REQ]:
    `${BADGE_BASE} bg-sky-100 text-sky-900 border-sky-300`,
  [RequisitionStatus.REQ_APPROVED]:
    `${BADGE_BASE} bg-indigo-100 text-indigo-900 border-indigo-300`,
  [RequisitionStatus.SENT_FOR_QUOTE]:
    `${BADGE_BASE} bg-cyan-100 text-cyan-900 border-cyan-300`,
  [RequisitionStatus.QUOTE_RECEIVED]:
    `${BADGE_BASE} bg-teal-100 text-teal-900 border-teal-300`,
  [RequisitionStatus.PARTIAL_QUOTE_RECEIVED]:
    `${BADGE_BASE} bg-amber-100 text-amber-950 border-amber-300`,
  [RequisitionStatus.QUOTE_APPROVED]:
    `${BADGE_BASE} bg-violet-100 text-violet-900 border-violet-300`,
  [RequisitionStatus.QUOTE_CONFIRMED_PO_SENT]:
    `${BADGE_BASE} bg-purple-100 text-purple-900 border-purple-300`,
  [RequisitionStatus.SPLIT]:
    `${BADGE_BASE} bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300`,
  [RequisitionStatus.REQ_RECEIVED_DELIVERED]:
    `${BADGE_BASE} bg-emerald-100 text-emerald-900 border-emerald-300`,
  [RequisitionStatus.REQ_RETURNED]:
    `${BADGE_BASE} bg-orange-100 text-orange-950 border-orange-300`,
  [RequisitionStatus.INVOICE_RECEIVED]:
    `${BADGE_BASE} bg-green-100 text-green-900 border-green-300`,
  [RequisitionStatus.CANCELLED]:
    `${BADGE_BASE} bg-rose-100 text-rose-900 border-rose-300`,
};

export const REQUISITION_TYPE_BADGE_CLASS: Record<RequisitionType, string> = {
  [RequisitionType.STR]:
    `${BADGE_BASE} bg-blue-100 text-blue-900 border-blue-300`,
  [RequisitionType.SPR]:
    `${BADGE_BASE} bg-orange-100 text-orange-950 border-orange-300`,
  [RequisitionType.GLY]:
    `${BADGE_BASE} bg-rose-100 text-rose-900 border-rose-300`,
  [RequisitionType.PNT]:
    `${BADGE_BASE} bg-purple-100 text-purple-900 border-purple-300`,
  [RequisitionType.REP]:
    `${BADGE_BASE} bg-amber-100 text-amber-950 border-amber-300`,
  [RequisitionType.SER]:
    `${BADGE_BASE} bg-teal-100 text-teal-900 border-teal-300`,
  [RequisitionType.CTM]:
    `${BADGE_BASE} bg-lime-100 text-lime-950 border-lime-300`,
  [RequisitionType.PRO]:
    `${BADGE_BASE} bg-green-100 text-green-900 border-green-300`,
  [RequisitionType.BNK]:
    `${BADGE_BASE} bg-yellow-100 text-yellow-950 border-yellow-400`,
  [RequisitionType.LUB]:
    `${BADGE_BASE} bg-cyan-100 text-cyan-900 border-cyan-300`,
  [RequisitionType.FCL]:
    `${BADGE_BASE} bg-indigo-100 text-indigo-900 border-indigo-300`,
  [RequisitionType.OTR]:
    `${BADGE_BASE} bg-stone-100 text-stone-800 border-stone-300`,
  [RequisitionType.CHE]:
    `${BADGE_BASE} bg-emerald-100 text-emerald-900 border-emerald-300`,
};

export const GENERATION_STATUS_BADGE_CLASS: Record<GenerationStatus, string> = {
  [GenerationStatus.SAVED_AS_DRAFT]:
    `${BADGE_BASE} bg-slate-100 text-slate-700 border-slate-300`,
  [GenerationStatus.CREATED]:
    `${BADGE_BASE} bg-sky-100 text-sky-800 border-sky-300`,
};

export function requisitionStatusBadgeClass(status: string | null | undefined): string {
  const key = String(status ?? "").toUpperCase() as RequisitionStatus;
  return REQUISITION_STATUS_BADGE_CLASS[key] ?? `${BADGE_BASE} bg-muted text-muted-foreground border-border`;
}

export function requisitionTypeBadgeClass(type: string | null | undefined): string {
  const key = String(type ?? "").toUpperCase() as RequisitionType;
  return REQUISITION_TYPE_BADGE_CLASS[key] ?? `${BADGE_BASE} bg-muted text-muted-foreground border-border`;
}

export function requisitionGenerationStatusBadgeClass(
  status: string | null | undefined
): string {
  const key = String(status ?? "").toUpperCase() as GenerationStatus;
  return GENERATION_STATUS_BADGE_CLASS[key] ?? `${BADGE_BASE} bg-muted text-muted-foreground border-border`;
}

export function requisitionStatusLabel(status: string | null | undefined): string {
  const key = String(status ?? "").toUpperCase() as RequisitionStatus;
  return REQUISITION_STATUS_LABELS[key] ?? String(status ?? "—");
}

export function requisitionTypeLabel(type: string | null | undefined): string {
  const key = String(type ?? "").toUpperCase() as RequisitionType;
  return REQUISITION_TYPE_LABELS[key] ?? String(type ?? "—");
}

export function requisitionGenerationStatusLabel(status: string | null | undefined): string {
  const key = String(status ?? "").toUpperCase() as GenerationStatus;
  return GENERATION_STATUS_LABELS[key] ?? String(status ?? "—");
}
