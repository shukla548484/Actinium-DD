import type { InputSectionDef } from "./types";

/** Common vessel-condition sections — all dry dock project types. */
export const COMMON_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "vessel_defects",
    label: "Current defects",
    description:
      "Add current defects, import Excel, and optionally record PMS notes and photos.",
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
      { key: "pmsOverdue", label: "PMS overdue items", type: "textarea" },
      { key: "machineryStatus", label: "Machinery status notes", type: "textarea" },
      { key: "photos", label: "Photos", type: "photos" },
    ],
  },
  {
    key: "vessel_safety",
    label: "Safety equipment",
    description: "LSA / FFA counts, due items, and previous certificate / service report.",
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
      { key: "lsaCounts", label: "LSA item counts", type: "text", required: true },
      { key: "ffaCounts", label: "FFA item counts", type: "text", required: true },
      { key: "lsaDueItems", label: "LSA due / overdue notes", type: "textarea" },
      { key: "ffaDueItems", label: "FFA due / overdue notes", type: "textarea" },
      {
        key: "fixedSystemMedia",
        label: "Fixed extinguishing system medium",
        type: "select",
        options: [
          { value: "co2", label: "CO2" },
          { value: "foam", label: "Foam" },
          { value: "water_mist", label: "Water mist" },
          { value: "dry_powder", label: "Dry powder" },
          { value: "other", label: "Other medium" },
        ],
      },
      { key: "fixedSystemOther", label: "Other medium (specify)", type: "text" },
      { key: "fixedSystemStatus", label: "Fixed extinguishing system status", type: "text" },
      { key: "lifeboatStatus", label: "Lifeboat status", type: "text" },
      { key: "davitStatus", label: "Davit status", type: "text" },
      { key: "previousCertificate", label: "Previous certificate", type: "files" },
      { key: "previousServiceReport", label: "Previous service report", type: "files" },
    ],
  },
];
