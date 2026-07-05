import type {
  VesselDefectEquipmentSystem,
  VesselDefectStatus,
} from "@/lib/shipAccess/crewDefectSystems";

export type VesselDefectDto = {
  id: string;
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  equipmentSystem: VesselDefectEquipmentSystem;
  equipmentLabel: string | null;
  location: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: VesselDefectStatus;
  reportedByEmployeeId: string | null;
  reportedByName: string | null;
  submittedAt: string | null;
  masterApprovedAt: string | null;
  masterApprovedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  linkedVesselJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListVesselDefectsQuery = {
  page?: number;
  limit?: number;
  vesselId?: string;
  status?: string;
  search?: string;
};
