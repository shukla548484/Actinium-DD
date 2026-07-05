/** Standard maintenance actions applied per component in V2.0 domain libraries. */
export const MTIL_V2_COMPONENT_ACTIONS = [
  "complete_overhaul",
  "partial_overhaul",
  "inspection",
  "measurement",
  "calibration",
  "pressure_testing",
  "alignment",
  "commissioning",
  "sea_trial_verification",
] as const;

export type MtilV2ComponentAction = (typeof MTIL_V2_COMPONENT_ACTIONS)[number];

export const MTIL_V2_COMPONENT_ACTION_LABELS: Record<MtilV2ComponentAction, string> = {
  complete_overhaul: "Complete overhaul",
  partial_overhaul: "Partial overhaul",
  inspection: "Inspection",
  measurement: "Measurement",
  calibration: "Calibration",
  pressure_testing: "Pressure testing",
  alignment: "Alignment",
  commissioning: "Commissioning",
  sea_trial_verification: "Sea trial verification",
};
