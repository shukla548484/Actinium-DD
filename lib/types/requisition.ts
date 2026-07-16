/** Minimal PMS-aligned requisition types used by purchase / IMPA helpers. */

export enum RequisitionType {
  STR = "STR",
  SPR = "SPR",
  GLY = "GLY",
  PNT = "PNT",
  REP = "REP",
  SER = "SER",
  CTM = "CTM",
  PRO = "PRO",
  BNK = "BNK",
  LUB = "LUB",
  FCL = "FCL",
  OTR = "OTR",
  CHE = "CHE",
}

export enum GenerationStatus {
  SAVED_AS_DRAFT = "SAVED_AS_DRAFT",
  CREATED = "CREATED",
}

export enum RequisitionStatus {
  NOT_READY = "NOT_READY",
  NEW_REQ = "NEW_REQ",
  REQ_APPROVED = "REQ_APPROVED",
  SENT_FOR_QUOTE = "SENT_FOR_QUOTE",
  QUOTE_RECEIVED = "QUOTE_RECEIVED",
  PARTIAL_QUOTE_RECEIVED = "PARTIAL_QUOTE_RECEIVED",
  QUOTE_APPROVED = "QUOTE_APPROVED",
  QUOTE_CONFIRMED_PO_SENT = "QUOTE_CONFIRMED_PO_SENT",
  SPLIT = "SPLIT",
  REQ_RECEIVED_DELIVERED = "REQ_RECEIVED_DELIVERED",
  REQ_RETURNED = "REQ_RETURNED",
  INVOICE_RECEIVED = "INVOICE_RECEIVED",
  CANCELLED = "CANCELLED",
}

export type ItemUrgency = "NORMAL" | "URGENT" | "CRITICAL" | "LOW" | "HIGH";

export const ITEM_URGENCY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
  CRITICAL: "Critical",
};

export const REQUISITION_TYPE_LABELS: Record<RequisitionType, string> = {
  [RequisitionType.STR]: "Store Requisition",
  [RequisitionType.SPR]: "Spares Requisition",
  [RequisitionType.GLY]: "Galley Requisition",
  [RequisitionType.PNT]: "Paint Requisition",
  [RequisitionType.REP]: "Repair Requisition Request",
  [RequisitionType.SER]: "Service Requisition Request",
  [RequisitionType.CTM]: "CTM Request",
  [RequisitionType.PRO]: "Provision Request",
  [RequisitionType.BNK]: "Bunker Request",
  [RequisitionType.LUB]: "Lube Oil Request",
  [RequisitionType.FCL]: "Flag/Class Request",
  [RequisitionType.OTR]: "Other Requisitions",
  [RequisitionType.CHE]: "Chemicals Requisition",
};

export const GENERATION_STATUS_LABELS: Record<GenerationStatus, string> = {
  [GenerationStatus.SAVED_AS_DRAFT]: "Saved as Draft",
  [GenerationStatus.CREATED]: "Ready",
};

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  [RequisitionStatus.NOT_READY]: "Not Ready",
  [RequisitionStatus.NEW_REQ]: "New Requisition",
  [RequisitionStatus.REQ_APPROVED]: "REQ Approved",
  [RequisitionStatus.SENT_FOR_QUOTE]: "Sent for Quote",
  [RequisitionStatus.QUOTE_RECEIVED]: "Quote Received",
  [RequisitionStatus.PARTIAL_QUOTE_RECEIVED]: "Partial Quote Received",
  [RequisitionStatus.QUOTE_APPROVED]: "Quote Approved",
  [RequisitionStatus.QUOTE_CONFIRMED_PO_SENT]: "Quote Confirmed / PO Sent",
  [RequisitionStatus.SPLIT]: "Split",
  [RequisitionStatus.REQ_RECEIVED_DELIVERED]: "Received / Delivered",
  [RequisitionStatus.REQ_RETURNED]: "Returned",
  [RequisitionStatus.INVOICE_RECEIVED]: "Invoice Received",
  [RequisitionStatus.CANCELLED]: "Cancelled",
};

export const CREW_REQUISITION_CREATOR_MIN_ACCESS = 17;
export const CREW_REQUISITION_CREATOR_MAX_ACCESS = 25;

export type PaginatedRequisitions<T = unknown> = {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
};
