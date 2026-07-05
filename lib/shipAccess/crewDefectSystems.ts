import type { LabeledOption } from "@/lib/ui/labeledSelect";

export const VESSEL_DEFECT_EQUIPMENT_SYSTEMS = [
  "main_engine",
  "auxiliary_engine",
  "boiler",
  "electrical",
  "navigation",
  "deck",
  "cargo",
  "safety",
  "piping",
  "pumps",
  "hull",
  "other",
] as const;

export type VesselDefectEquipmentSystem = (typeof VESSEL_DEFECT_EQUIPMENT_SYSTEMS)[number];

const EQUIPMENT_SYSTEM_LABELS: Record<VesselDefectEquipmentSystem, string> = {
  main_engine: "Main engine",
  auxiliary_engine: "Auxiliary engine",
  boiler: "Boiler",
  electrical: "Electrical",
  navigation: "Navigation / GMDSS",
  deck: "Deck machinery",
  cargo: "Cargo systems",
  safety: "Safety equipment",
  piping: "Piping / valves",
  pumps: "Pumps",
  hull: "Hull / structure",
  other: "Other system",
};

export const VESSEL_DEFECT_EQUIPMENT_SYSTEM_ITEMS: LabeledOption[] =
  VESSEL_DEFECT_EQUIPMENT_SYSTEMS.map((value) => ({
    value,
    label: EQUIPMENT_SYSTEM_LABELS[value],
  }));

export const VESSEL_DEFECT_STATUSES = [
  "draft",
  "submitted",
  "master_approved",
  "rejected",
  "cancelled",
] as const;

export type VesselDefectStatus = (typeof VESSEL_DEFECT_STATUSES)[number];

const DEFECT_STATUS_LABELS: Record<VesselDefectStatus, string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting Master",
  master_approved: "Master approved",
  rejected: "Rejected by Master",
  cancelled: "Cancelled",
};

export const VESSEL_DEFECT_STATUS_ITEMS: LabeledOption[] = VESSEL_DEFECT_STATUSES.map(
  (value) => ({
    value,
    label: DEFECT_STATUS_LABELS[value],
  }),
);

export function equipmentSystemLabel(system: VesselDefectEquipmentSystem): string {
  return EQUIPMENT_SYSTEM_LABELS[system] ?? system;
}

export function defectStatusLabel(status: VesselDefectStatus): string {
  return DEFECT_STATUS_LABELS[status] ?? status;
}

/** Suggest equipment label from vessel technical profile for known systems. */
export function suggestEquipmentLabel(
  system: VesselDefectEquipmentSystem,
  profile: {
    mainEngine?: string | null;
    auxiliaryEngine?: string | null;
    boilerInfo?: string | null;
  },
): string | null {
  switch (system) {
    case "main_engine":
      return profile.mainEngine?.trim() || null;
    case "auxiliary_engine":
      return profile.auxiliaryEngine?.trim() || null;
    case "boiler":
      return profile.boilerInfo?.trim() || null;
    default:
      return null;
  }
}
