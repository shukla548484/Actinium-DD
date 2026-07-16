import { isAdminEquivalentAccessLevel } from '@/lib/admin-access-level';
import {
  requisitionNumberPrefix,
  recordOriginFromAccessLevel,
  type OriginLetter,
  type RecordOriginChannel,
  isCrewOriginatedRequisitionNumber,
} from "@/lib/sync/record-origin-suffix";

/** Requisition Purpose: why the requisition is being raised */
export const REQUISITION_PURPOSE = {
  ROUTINE_MAINTENANCE: 'ROUTINE_MAINTENANCE',
  DEFECT_CLOSER_REQUISITION: 'DEFECT_CLOSER_REQUISITION',
  DRY_DOCK: 'DRY_DOCK',
  SPECIAL_REQUIREMENT: 'SPECIAL_REQUIREMENT',
  OTHERS: 'OTHERS',
} as const;

export type RequisitionPurpose = (typeof REQUISITION_PURPOSE)[keyof typeof REQUISITION_PURPOSE];

export const REQUISITION_PURPOSE_LABELS: Record<RequisitionPurpose, string> = {
  ROUTINE_MAINTENANCE: 'Routine Maintenance',
  DEFECT_CLOSER_REQUISITION: 'Defect Closer Requisition',
  DRY_DOCK: 'Dry Dock',
  SPECIAL_REQUIREMENT: 'Special Requirement',
  OTHERS: 'Others',
};

export enum RequisitionType {
  STR = 'STR', // Store Requisition
  SPR = 'SPR', // Spares Requisition
  GLY = 'GLY', // Galley Requisition
  PNT = 'PNT', // Paint Requisition
  REP = 'REP', // Repair Requisition Request
  SER = 'SER', // Service Requisition Request
  CTM = 'CTM', // CTM Request
  PRO = 'PRO', // Provision Request
  BNK = 'BNK', // Bunker Request
  LUB = 'LUB', // Lube Oil Request
  FCL = 'FCL', // Flag/Class Request
  OTR = 'OTR', // Other Requisitions
  CHE = 'CHE', // Chemicals Requisition
}

export enum GenerationStatus {
  SAVED_AS_DRAFT = 'SAVED_AS_DRAFT',
  CREATED = 'CREATED',
}

export enum RequisitionStatus {
  NOT_READY = 'NOT_READY', // Not Ready
  NEW_REQ = 'NEW_REQ', // New Requisition
  REQ_APPROVED = 'REQ_APPROVED', // REQ Approved
  SENT_FOR_QUOTE = 'SENT_FOR_QUOTE', // Sent for Quote (Req Sent for Quote)
  QUOTE_RECEIVED = 'QUOTE_RECEIVED', // Quote Received
  PARTIAL_QUOTE_RECEIVED = 'PARTIAL_QUOTE_RECEIVED', // Partial Quote Received
  QUOTE_APPROVED = 'QUOTE_APPROVED', // Quote Approved
  QUOTE_CONFIRMED_PO_SENT = 'QUOTE_CONFIRMED_PO_SENT', // Quote Confirmed/Po Sent
  SPLIT = 'SPLIT', // Split across multiple vendors
  REQ_RECEIVED_DELIVERED = 'REQ_RECEIVED_DELIVERED', // REQ Received/Delivered
  REQ_RETURNED = 'REQ_RETURNED', // REQ Returned
  INVOICE_RECEIVED = 'INVOICE_RECEIVED', // Invoice Received
  CANCELLED = 'CANCELLED', // Cancelled
}

export enum ItemUrgency {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface RequisitionItem {
  id: string;
  requisitionId: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  urgency: ItemUrgency;
  remarks?: string;
  impaNumber?: string; // IMPA Code/Number
  // Spare requisition fields
  machineryInstanceId?: string;
  manualMachineryName?: string;
  partNumber?: string;
  partName?: string;
  itemNumber?: string;
  drawingNumber?: string;
  currentRob?: number;
  addToInventory?: boolean;
  // Lube oil requisition fields
  oilGrade?: string;
  quantityInLiters?: number;
  // Paint requisition fields
  paintBrand?: string;
  paintProductName?: string;
  paintColorGrade?: string;
  paintColorName?: string;
  paintColorHex?: string;
  paintType?: string;
  paintCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Requisition {
  id: string;
  requisitionNumber: string;
  manualReqNumber?: string;
  heading: string;
  dateOfCreation: Date;
  description?: string;
  portOfSupply?: string;
  requisitionType: RequisitionType;
  subCategoryCode?: string | null;
  /** Resolved from requisition_sub_categories.name (department). */
  subCategoryName?: string | null;
  generationStatus: GenerationStatus;
  status: RequisitionStatus;
  portAgentDetails?: string;
  isEditable: boolean;
  createdById: string;
  vesselId: string;
  approvedById?: string;
  approvedAt?: Date;
  returnComments?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedById?: string | null;
  linkedReason?: string;
  linkedReasonType?: string;
  linkedReasonId?: string;
  priority?: string; // NORMAL | URGENT | CRITICAL (requisition urgency)
  reasonForRequisition?: string;
  requisitionPurpose?: RequisitionPurpose | null;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
  vessel?: {
    id: string;
    name: string;
    code: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  };
  items?: RequisitionItem[];
  purchaseOrders?: {
    id: string;
    poNumber: string;
    status: string;
    dateOfIssue: Date;
  }[];
  purchaseOrderCount?: number;
  activePurchaseOrderCount?: number;
  reorderAlerts?: Array<{
    id: string;
    status: string;
    sparePart: {
      id: string;
      name: string;
      sparePartNumber: string;
    };
  }>;
  vendorQuotes?: {
    id: string;
    status: string;
    vendorId: string;
    vendor?: {
      id: string;
      name: string;
    } | null;
    quotedItems?: Array<{
      unitPrice?: unknown | null;
      totalPrice?: unknown | null;
    }>;
  }[];
  quoteStats?: {
    totalQuotesSent: number;
    receivedQuotes: number;
    declinedQuotes: number;
  };
  parentRequisitionId?: string | null;
  splitIndex?: number | null;
  parentRequisition?: {
    id: string;
    requisitionNumber: string;
  } | null;
  childRequisitions?: Array<{
    id: string;
    requisitionNumber: string;
    status?: RequisitionStatus;
    heading?: string;
    requisitionType?: RequisitionType;
    dateOfCreation?: Date;
    splitIndex?: number | null;
  }>;
}

export interface CreateRequisitionData {
  heading: string;
  manualReqNumber?: string;
  description?: string;
  portOfSupply?: string;
  requisitionType: RequisitionType;
  /** Department / area code, e.g. STR-ENG. Omit for CTM. Primary code when multiple (LUB). */
  subCategoryCode?: string | null;
  /** LUB only: all selected sub-category codes (stored in details_json). */
  subCategoryCodes?: string[];
  requisitionPurpose?: RequisitionPurpose;
  contractId?: string;
  budgetCode?: string;
  glCode?: string;
  costCenter?: string;
  portAgentDetails?: string;
  vesselId: string;
  items: CreateRequisitionItemData[];
  generationStatus?: GenerationStatus;
  isEditable?: boolean;
}

export interface CreateRequisitionItemData {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  urgency: ItemUrgency;
  remarks?: string;
  impaCode?: string; // IMPA Code (mapped to impaNumber in database)
}

export interface UpdateRequisitionData extends Partial<CreateRequisitionData> {
  id: string;
}

export interface RequisitionFilters {
  search?: string;
  requisitionType?: RequisitionType;
  generationStatus?: GenerationStatus;
  status?: RequisitionStatus;
  vesselId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedRequisitions {
  requisitions: Requisition[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const REQUISITION_TYPE_LABELS: Record<RequisitionType, string> = {
  [RequisitionType.STR]: 'Store Requisition',
  [RequisitionType.SPR]: 'Spares Requisition',
  [RequisitionType.GLY]: 'Galley Requisition',
  [RequisitionType.PNT]: 'Paint Requisition',
  [RequisitionType.REP]: 'Repair Requisition Request',
  [RequisitionType.SER]: 'Service Requisition Request',
  [RequisitionType.CTM]: 'CTM Request',
  [RequisitionType.PRO]: 'Provision Request',
  [RequisitionType.BNK]: 'Bunker Request',
  [RequisitionType.LUB]: 'Lube Oil Request',
  [RequisitionType.FCL]: 'Flag/Class Request',
  [RequisitionType.OTR]: 'Other Requisitions',
  [RequisitionType.CHE]: 'Chemicals Requisition',
};

export const GENERATION_STATUS_LABELS: Record<GenerationStatus, string> = {
  [GenerationStatus.SAVED_AS_DRAFT]: 'Saved as Draft',
  [GenerationStatus.CREATED]: 'Ready',
};

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  [RequisitionStatus.NOT_READY]: 'Not Ready',
  [RequisitionStatus.NEW_REQ]: 'New Requisition',
  [RequisitionStatus.REQ_APPROVED]: 'REQ Approved',
  [RequisitionStatus.SENT_FOR_QUOTE]: 'Req Sent for Quote',
  [RequisitionStatus.QUOTE_RECEIVED]: 'Quote Received',
  [RequisitionStatus.PARTIAL_QUOTE_RECEIVED]: 'Partial Quote Received',
  [RequisitionStatus.QUOTE_APPROVED]: 'Quote Approved',
  [RequisitionStatus.QUOTE_CONFIRMED_PO_SENT]: 'Quote Confirmed/Po Sent',
  [RequisitionStatus.SPLIT]: 'Split',
  [RequisitionStatus.REQ_RECEIVED_DELIVERED]: 'REQ Received/Delivered',
  [RequisitionStatus.REQ_RETURNED]: 'REQ Returned',
  [RequisitionStatus.INVOICE_RECEIVED]: 'Invoice Received',
  [RequisitionStatus.CANCELLED]: 'Cancelled',
};

export const ITEM_URGENCY_LABELS: Record<ItemUrgency, string> = {
  [ItemUrgency.LOW]: 'Low',
  [ItemUrgency.NORMAL]: 'Normal',
  [ItemUrgency.HIGH]: 'High',
  [ItemUrgency.URGENT]: 'Urgent',
};

/** Deck/engine crew (17–25) may raise vessel (V.*) requisitions; stays draft until Master (25) approves. */
export const CREW_REQUISITION_CREATOR_MIN_ACCESS = 17;
export const CREW_REQUISITION_CREATOR_MAX_ACCESS = 25;

export function generateRequisitionNumberForOrigin(
  vessel: { code: string },
  type: RequisitionType,
  year: number,
  sequence: number,
  origin: RecordOriginChannel
): string {
  const prefix = requisitionNumberPrefix(origin);
  return `${prefix}.${vessel.code}.${type}.${year.toString().slice(-2)}.${sequence.toString().padStart(4, "0")}`;
}

/** @deprecated Prefer {@link generateRequisitionNumberForOrigin} with resolved origin channel. */
export const generateRequisitionNumber = (
  vessel: { code: string },
  type: RequisitionType,
  year: number,
  sequence: number,
  designationAccessLevel: number
): string => {
  return generateRequisitionNumberForOrigin(
    vessel,
    type,
    year,
    sequence,
    recordOriginFromAccessLevel(designationAccessLevel)
  );
};

/**
 * Shore/office users at this access or above may create O.* requisitions via the same APIs as vessel crew.
 * Submitted (CREATED) O.* requisitions from these users go straight to {@link RequisitionStatus.NEW_REQ} — no Master approval.
 */
export const OFFICE_REQUISITION_CREATOR_MIN_ACCESS = 32;

export function canOfficeCreateRequisition(designationAccessLevel?: number | null): boolean {
  if (designationAccessLevel == null) return false;
  return designationAccessLevel >= OFFICE_REQUISITION_CREATOR_MIN_ACCESS;
}

/**
 * Initial status when persisting a new requisition.
 * V.* + CREATED → NOT_READY (Master). O.* + draft → NOT_READY. O.* + CREATED + access ≥ 32 → NEW_REQ.
 */
export function initialStatusForNewRequisition(
  generationStatus: GenerationStatus,
  numberPrefix: OriginLetter,
  designationAccessLevel: number | null | undefined
): RequisitionStatus {
  if (generationStatus !== GenerationStatus.CREATED) {
    return RequisitionStatus.NOT_READY;
  }
  if (numberPrefix === "V" || numberPrefix === "T") {
    return RequisitionStatus.NOT_READY;
  }
  const lvl = designationAccessLevel ?? 0;
  if (lvl >= OFFICE_REQUISITION_CREATOR_MIN_ACCESS) {
    return RequisitionStatus.NEW_REQ;
  }
  return RequisitionStatus.NOT_READY;
}

// Helper function to check if user can create requisitions (vessel crew 17–25 only)
export const canCreateRequisition = (designationAccessLevel?: number | null): boolean => {
  if (designationAccessLevel == null) return false;
  return (
    designationAccessLevel >= CREW_REQUISITION_CREATOR_MIN_ACCESS &&
    designationAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
  );
};

// Helper function to check if user is a Master (can approve)
export const isMaster = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return designationAccessLevel === 25;
};

/**
 * @deprecated DO NOT USE THIS FUNCTION - It uses hardcoded designation mapping and is unreliable
 * 
 * ⚠️ CRITICAL: Always use designationAccessLevel from the employee database record instead.
 * 
 * This function was created as a fallback but should NOT be used in production code.
 * The designationAccessLevel field in the employees table is the source of truth.
 * 
 * If you need access level:
 * 1. Fetch designationAccessLevel directly from prisma.employee record
 * 2. Only use this function as a LAST RESORT fallback if designationAccessLevel is null
 * 3. Log a warning when using this fallback so it can be fixed
 * 
 * Example CORRECT usage:
 * ```typescript
 * const employee = await prisma.employee.findUnique({
 *   where: { id: userId },
 *   select: { designationAccessLevel: true }
 * });
 * const accessLevel = employee.designationAccessLevel; // ✅ Use this
 * ```
 * 
 * Example WRONG usage (DO NOT DO THIS):
 * ```typescript
 * const accessLevel = getDesignationAccessLevel(employee.designation); // ❌ Don't use
 * ```
 */
export const getDesignationAccessLevel = (designation?: string): number | undefined => {
  if (!designation) return undefined;
  
  // ⚠️ WARNING: This is a hardcoded mapping with limited designations
  // This should NOT be used - always prefer designationAccessLevel from database
  console.warn(
    `[DEPRECATED] getDesignationAccessLevel() called with designation: "${designation}". ` +
    `This function uses hardcoded mapping and may return incorrect results. ` +
    `Always use designationAccessLevel from the employee database record instead.`
  );
  
  const designationLevels: Record<string, number> = {
    'Master': 25,
    'Chief Officer': 24,
    'Second Officer': 23,
    'Third Officer': 22,
    'Chief Engineer': 25,
    'Second Engineer': 24,
    'Third Engineer': 23,
    'Fourth Engineer': 22,
    'Bosun': 21,
    'AB Seaman': 20,
    'Ordinary Seaman': 19,
    'Cook': 18,
    'Messman': 17,
    // Office staff levels 26-50
    'System Administrator': 50, // Highest access level
    'Senior Administrator': 45,
    'Administrator': 40,
    'Shore Manager': 35,
    'Assistant Manager': 32,
    'Superintendent': 30,
    'Marine Engineer': 28,
    'Technical Officer': 26,
    'Operations Manager': 35,
    'Technical Manager': 35,
    'Fleet Manager': 35,
    'Marine Superintendent': 30,
    'Technical Superintendent': 30,
    // Add more designations as needed
  };
  
  return designationLevels[designation];
};

// Helper function to check if requisition needs Master approval for generation
export const needsMasterApprovalForGeneration = (requisitionNumber: string): boolean => {
  return isCrewOriginatedRequisitionNumber(requisitionNumber);
};

// Helper function to check if user can view requisition based on status and access level
export const canViewRequisition = (
  status: RequisitionStatus,
  designationAccessLevel?: number
): boolean => {
  if (designationAccessLevel === undefined || designationAccessLevel === null) return false;
  
  // System admin tiers can view all requisitions
  if (isAdminEquivalentAccessLevel(designationAccessLevel)) {
    return true;
  }
  
  switch (status) {
    case RequisitionStatus.NOT_READY:
      // Visible to crew who can raise drafts (17–25), including Master
      return (
        designationAccessLevel >= CREW_REQUISITION_CREATOR_MIN_ACCESS &&
        designationAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
      );
    
    case RequisitionStatus.NEW_REQ:
      // Visible to crew (6-25) as "New Requisition" and shore (26+) as well
      return designationAccessLevel >= 6;
    
    case RequisitionStatus.REQ_APPROVED:
      // "Ready" status — visible to crew (6-25) and shore (26+)
      return designationAccessLevel >= 6;
    
    case RequisitionStatus.SENT_FOR_QUOTE:
    case RequisitionStatus.QUOTE_RECEIVED:
    case RequisitionStatus.PARTIAL_QUOTE_RECEIVED:
    case RequisitionStatus.QUOTE_APPROVED:
    case RequisitionStatus.QUOTE_CONFIRMED_PO_SENT:
    case RequisitionStatus.SPLIT:
    case RequisitionStatus.REQ_RECEIVED_DELIVERED:
    case RequisitionStatus.REQ_RETURNED:
    case RequisitionStatus.INVOICE_RECEIVED:
    case RequisitionStatus.CANCELLED:
      // Procurement statuses beyond REQ_APPROVED: visible to shore (26+) only.
      // Crew (6-25) must NOT see these — they only see NOT_READY, NEW_REQ, REQ_APPROVED.
      return designationAccessLevel >= 26 || isAdminEquivalentAccessLevel(designationAccessLevel);
    
    default:
      // All other statuses visible to all users who can create requisitions
      return canCreateRequisition(designationAccessLevel);
  }
};

// Master (25) or admins: approve vessel V.* drafts (generation / NOT_READY) before shore sees NEW_REQ
export const canMasterApproveVesselRequisitionDraft = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return isMaster(designationAccessLevel) || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Office: approve non–V-prefixed NOT_READY / office workflow steps (not the vessel Master gate)
export const canOfficeApproveNotReadyRequisition = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return [39, 50].includes(designationAccessLevel) || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Helper: shore approval after NEW_REQ (37, 39, 50 / admins — 37 only NEW_REQ → REQ_APPROVED)
export const canApproveRequisition = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return designationAccessLevel === 37 || designationAccessLevel === 39 || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Helper function to check if user can send requisitions for quote (access levels 32, 33, 50)
export const canSendForQuote = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return designationAccessLevel === 32 || designationAccessLevel === 33 || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Helper function to automatically determine if requisition should be editable based on status
export const getIsEditableFromStatus = (status: RequisitionStatus): boolean => {
  // Rule: if status = NOT_READY (Created) then isEditable = true, else isEditable = false
  return status === RequisitionStatus.NOT_READY;
};

// Helper function to check if user can cancel requisitions (access levels 32, 33, 39, 50)
export const canCancelRequisition = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return designationAccessLevel === 32 || designationAccessLevel === 33 || designationAccessLevel === 39 || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Helper function to check if user can return requisitions (access levels 39, 50)
export const canReturnRequisition = (designationAccessLevel?: number): boolean => {
  if (!designationAccessLevel) return false;
  return designationAccessLevel === 39 || isAdminEquivalentAccessLevel(designationAccessLevel);
};

// Helper function to check if user can edit requisition
export const canEditRequisition = (
  requisition: Requisition,
  designationAccessLevel?: number
): boolean => {
  if (!designationAccessLevel || !requisition.isEditable) return false;
  
  // Once status is NEW_REQ, requisition items and details cannot be modified
  if (requisition.status === RequisitionStatus.NEW_REQ) {
    return false;
  }
  
  // Requisitions with QUOTE_CONFIRMED_PO_SENT status cannot be edited (PO has been sent)
  if (requisition.status === RequisitionStatus.QUOTE_CONFIRMED_PO_SENT) {
    return false;
  }

  // Requisitions that have been split cannot be edited (children have been created)
  if (requisition.status === RequisitionStatus.SPLIT) {
    return false;
  }
  
  // Requisitions that are received/delivered cannot be edited
  if (requisition.status === RequisitionStatus.REQ_RECEIVED_DELIVERED) {
    return false;
  }
  
  // If returned to NOT_READY (Created), can be edited by crew 17–25
  if (requisition.status === RequisitionStatus.NOT_READY && requisition.generationStatus === GenerationStatus.CREATED) {
    return (
      designationAccessLevel >= CREW_REQUISITION_CREATOR_MIN_ACCESS &&
      designationAccessLevel <= CREW_REQUISITION_CREATOR_MAX_ACCESS
    );
  }
  
  // For other statuses, normal creation rules apply
  return canCreateRequisition(designationAccessLevel);
};
