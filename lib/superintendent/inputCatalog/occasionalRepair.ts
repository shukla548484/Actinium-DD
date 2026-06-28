import type { InputSectionDef } from "./types";

/** DD04 Occasional Repair — vessel sections. */
export const OCCASIONAL_REPAIR_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "occ_repair_request",
    label: "Repair request",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["occasional_repair"],
    mandatory: true,
    fields: [
      { key: "defectDescription", label: "Defect description", type: "textarea", required: true },
      { key: "location", label: "Location", type: "text", required: true },
      { key: "urgency", label: "Urgency", type: "select", options: [
        { value: "before_voyage", label: "Before next voyage" },
        { value: "next_port", label: "Next port" },
        { value: "next_docking", label: "Next docking" },
      ]},
    ],
  },
  {
    key: "occ_photos",
    label: "Current condition",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["occasional_repair"],
    fields: [
      { key: "photosNote", label: "Photos", type: "photos_note" },
      { key: "pmsLink", label: "Related PMS job", type: "text" },
    ],
  },
  {
    key: "occ_spares_access",
    label: "Spares & access",
    pageKey: "vessel",
    moduleId: "spares",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["occasional_repair"],
    fields: [
      { key: "onboardSpares", label: "Onboard spare availability", type: "textarea" },
      { key: "accessMethod", label: "Afloat / dock access", type: "select", options: [
        { value: "afloat", label: "Afloat" },
        { value: "dock", label: "Dock required" },
        { value: "either", label: "Either" },
      ]},
    ],
  },
];
