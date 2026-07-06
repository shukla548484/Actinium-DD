/** Default general service items seeded per shipyard profile. */
export const YARD_GENERAL_SERVICE_SEED = [
  { lineCode: "GS-001", description: "Fireman watch", unit: "USD/person/shift", defaultQty: 1, defaultLabourHours: 8, defaultLabourRate: 45 },
  { lineCode: "GS-002", description: "Security patrol", unit: "USD/person/shift", defaultQty: 1, defaultLabourHours: 8, defaultLabourRate: 40 },
  { lineCode: "GS-003", description: "Temporary ventilation", unit: "USD/unit/day", defaultQty: 2, defaultMaterialCost: 120, defaultEquipmentCost: 80 },
  { lineCode: "GS-004", description: "Temporary lighting", unit: "USD/unit/day", defaultQty: 4, defaultMaterialCost: 60, defaultEquipmentCost: 40 },
  { lineCode: "UT-001", description: "Cooling water line (daily charge)", unit: "USD/connection/day", defaultQty: 5, defaultMaterialCost: 150 },
  { lineCode: "UT-003", description: "Shore power / electrical (daily)", unit: "USD/connection/day", defaultQty: 2, defaultEquipmentCost: 200 },
  { lineCode: "UT-005", description: "Fresh water supply (daily)", unit: "USD/connection/day", defaultQty: 1, defaultMaterialCost: 80 },
  { lineCode: "UT-007", description: "Garbage disposal", unit: "USD/day", defaultQty: 1, defaultMaterialCost: 250 },
] as const;

export const YARD_COST_TEMPLATE_SEED = [
  {
    name: "Standard rates",
    targetOwnerLabel: "Generic / open market",
    marginPct: 12,
    isDefault: true,
    rateMultiplier: 1,
  },
  {
    name: "Premium owner",
    targetOwnerLabel: "Major shipowner — conservative margin",
    marginPct: 15,
    isDefault: false,
    rateMultiplier: 1.12,
  },
  {
    name: "Aggressive bid",
    targetOwnerLabel: "Competitive / new customer",
    marginPct: 8,
    isDefault: false,
    rateMultiplier: 0.92,
  },
] as const;
