import type { InputSectionDef } from "./types";

/** DD07 Emergency Docking — vessel sections. */
export const EMERGENCY_DOCKING_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "em_cause",
    label: "Emergency cause",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["emergency_docking"],
    mandatory: true,
    attachmentRequired: true,
    fields: [
      { key: "cause", label: "Cause (grounding, collision, machinery failure…)", type: "textarea", required: true },
      { key: "incidentTime", label: "Incident time", type: "text", required: true },
    ],
  },
  {
    key: "em_condition",
    label: "Current condition",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["emergency_docking"],
    mandatory: true,
    fields: [
      { key: "safetyCondition", label: "Safety condition", type: "textarea", required: true },
      { key: "seaworthiness", label: "Seaworthiness assessment", type: "textarea", required: true },
      { key: "photosNote", label: "Urgent evidence photos", type: "photos_note", required: true },
    ],
  },
  {
    key: "em_class_temp",
    label: "Class & temporary repair",
    pageKey: "vessel",
    moduleId: "survey",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["emergency_docking"],
    fields: [
      { key: "classRestriction", label: "Class restriction / condition", type: "textarea" },
      { key: "temporaryRepair", label: "Temporary repair onboard", type: "textarea" },
    ],
  },
  {
    key: "em_risk",
    label: "Risk register",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["emergency_docking"],
    mandatory: true,
    fields: [
      { key: "floodingRisk", label: "Flooding risk", type: "select", options: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ]},
      { key: "pollutionRisk", label: "Pollution risk", type: "textarea" },
      { key: "propulsionRisk", label: "Propulsion risk", type: "textarea" },
    ],
  },
];
