import type { LabeledOption } from "@/lib/ui/labeledSelect";

export const VESSEL_REQUISITION_TYPES = ["spr"] as const;
export type VesselRequisitionType = (typeof VESSEL_REQUISITION_TYPES)[number];

export const VESSEL_REQUISITION_PURPOSES = ["routine_maintenance", "defect_closer"] as const;
export type VesselRequisitionPurpose = (typeof VESSEL_REQUISITION_PURPOSES)[number];

export const VESSEL_REQUISITION_STATUSES = [
  "draft",
  "submitted",
  "master_approved",
  "rejected",
  "cancelled",
  "converted",
] as const;
export type VesselRequisitionStatus = (typeof VESSEL_REQUISITION_STATUSES)[number];

export const VESSEL_REQUISITION_LINE_URGENCIES = ["low", "normal", "high", "urgent"] as const;
export type VesselRequisitionLineUrgency = (typeof VESSEL_REQUISITION_LINE_URGENCIES)[number];

const TYPE_LABELS: Record<VesselRequisitionType, string> = {
  spr: "Spares (SPR)",
};

const PURPOSE_LABELS: Record<VesselRequisitionPurpose, string> = {
  routine_maintenance: "Routine maintenance",
  defect_closer: "Defect closer requisition",
};

const STATUS_LABELS: Record<VesselRequisitionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting Master",
  master_approved: "Master approved",
  rejected: "Rejected by Master",
  cancelled: "Cancelled",
  converted: "Converted to office spares",
};

const URGENCY_LABELS: Record<VesselRequisitionLineUrgency, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const VESSEL_REQUISITION_TYPE_ITEMS: LabeledOption[] = VESSEL_REQUISITION_TYPES.map(
  (value) => ({ value, label: TYPE_LABELS[value] }),
);

export const VESSEL_REQUISITION_PURPOSE_ITEMS: LabeledOption[] =
  VESSEL_REQUISITION_PURPOSES.map((value) => ({ value, label: PURPOSE_LABELS[value] }));

export const VESSEL_REQUISITION_STATUS_ITEMS: LabeledOption[] = VESSEL_REQUISITION_STATUSES.map(
  (value) => ({ value, label: STATUS_LABELS[value] }),
);

export const VESSEL_REQUISITION_URGENCY_ITEMS: LabeledOption[] =
  VESSEL_REQUISITION_LINE_URGENCIES.map((value) => ({ value, label: URGENCY_LABELS[value] }));

export function requisitionStatusLabel(status: VesselRequisitionStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** PMS-compatible vessel requisition number: V.{vesselCode}.SPR.{yy}.{seq} */
export function generateVesselRequisitionNumber(
  vesselCode: string,
  year: number,
  sequence: number,
): string {
  return `V.${vesselCode}.SPR.${year.toString().slice(-2)}.${sequence.toString().padStart(4, "0")}`;
}

export const VESSEL_REQUISITION_UNITS = ["pcs", "set", "kg", "ltr", "m", "roll"] as const;

export const VESSEL_REQUISITION_UNIT_ITEMS: LabeledOption[] = VESSEL_REQUISITION_UNITS.map(
  (value) => ({ value, label: value }),
);
