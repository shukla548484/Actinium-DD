import type { InputSectionDef } from "./types";

/** DD05 Underwater Survey (UWILD) — vessel sections. */
export const UNDERWATER_SURVEY_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "uw_hull",
    label: "Hull condition",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    mandatory: true,
    fields: [
      { key: "foulingCondition", label: "Fouling condition", type: "textarea", required: true },
      { key: "knownDamage", label: "Known damage", type: "textarea" },
    ],
  },
  {
    key: "uw_propeller",
    label: "Propeller",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    fields: [
      { key: "vibration", label: "Vibration", type: "textarea" },
      { key: "damage", label: "Damage", type: "textarea" },
      { key: "ropeEntanglement", label: "Rope entanglement", type: "textarea" },
    ],
  },
  {
    key: "uw_rudder",
    label: "Rudder",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    fields: [
      { key: "abnormalNoise", label: "Abnormal noise / vibration", type: "textarea" },
    ],
  },
  {
    key: "uw_sea_chest",
    label: "Sea chest",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    fields: [
      { key: "blockageConcern", label: "Blockage concern", type: "textarea" },
    ],
  },
  {
    key: "uw_location",
    label: "Location & conditions",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    mandatory: true,
    fields: [
      { key: "anchoragePort", label: "Anchorage / port", type: "text", required: true },
      { key: "waterVisibility", label: "Water visibility", type: "text" },
      { key: "current", label: "Current / tidal notes", type: "text" },
      { key: "previousReport", label: "Previous underwater report ref", type: "text" },
      { key: "classRequirement", label: "Class requirement", type: "textarea" },
    ],
  },
];
