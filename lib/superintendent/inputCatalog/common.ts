import type { InputSectionDef } from "./types";

/** Common vessel-condition sections — all dry dock project types. */
export const COMMON_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "vessel_defects",
    label: "Current defects",
    description: "Open defects and machinery abnormalities before docking.",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "damage_repair",
      "occasional_repair",
      "underwater_survey",
      "new_installation",
      "emergency_docking",
      "layup_reactivation",
      "conversion_modification",
      "warranty_repair",
    ],
    mandatory: true,
    fields: [
      { key: "openDefects", label: "Open defects summary", type: "textarea", required: true },
      { key: "pmsOverdue", label: "PMS overdue items", type: "textarea" },
      { key: "machineryStatus", label: "Machinery status", type: "textarea", required: true },
      { key: "photosNote", label: "Photos attached (reference)", type: "photos_note" },
    ],
  },
  {
    key: "vessel_safety",
    label: "Safety equipment",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "damage_repair",
      "occasional_repair",
      "layup_reactivation",
    ],
    fields: [
      { key: "lsaDueItems", label: "LSA due / overdue", type: "textarea" },
      { key: "ffaDueItems", label: "FFA due / overdue", type: "textarea" },
      { key: "co2System", label: "CO2 / fixed fire system status", type: "text" },
      { key: "lifeboatDavit", label: "Lifeboat / davit status", type: "text" },
    ],
  },
];
