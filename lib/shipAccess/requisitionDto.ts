import type {
  VesselRequisitionLineUrgency,
  VesselRequisitionPurpose,
  VesselRequisitionStatus,
  VesselRequisitionType,
} from "@/lib/shipAccess/requisitionTypes";
import type { VesselDefectDto } from "@/lib/shipAccess/defectTypes";

export type VesselRequisitionLineDto = {
  id: string;
  requisitionId: string;
  partName: string;
  partNumber: string | null;
  description: string | null;
  quantity: number;
  unit: string;
  urgency: VesselRequisitionLineUrgency;
  equipmentLabel: string | null;
  remarks: string | null;
  sortOrder: number;
  integratedDdSparesItemId: string | null;
};

export type VesselRequisitionDto = {
  id: string;
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  vesselDefectId: string;
  targetDryDockProjectId: string | null;
  integratedDryDockProjectId: string | null;
  requisitionNumber: string;
  heading: string;
  description: string | null;
  requisitionType: VesselRequisitionType;
  requisitionPurpose: VesselRequisitionPurpose;
  portOfSupply: string | null;
  status: VesselRequisitionStatus;
  requestedByEmployeeId: string | null;
  requestedByName: string | null;
  submittedAt: string | null;
  masterApprovedAt: string | null;
  masterApprovedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  convertedAt: string | null;
  convertedByName: string | null;
  createdAt: string;
  updatedAt: string;
  lines: VesselRequisitionLineDto[];
  defect?: Pick<
    VesselDefectDto,
    | "id"
    | "title"
    | "equipmentSystem"
    | "equipmentLabel"
    | "location"
    | "priority"
    | "status"
  >;
};

export type ListVesselRequisitionsQuery = {
  page?: number;
  limit?: number;
  vesselId?: string;
  dryDockProjectId?: string;
  status?: string;
  search?: string;
  bankOnly?: boolean;
};

export type RequisitionLineInput = {
  partName: string;
  partNumber?: string | null;
  description?: string | null;
  quantity?: number;
  unit?: string;
  urgency?: VesselRequisitionLineUrgency;
  equipmentLabel?: string | null;
  remarks?: string | null;
};
