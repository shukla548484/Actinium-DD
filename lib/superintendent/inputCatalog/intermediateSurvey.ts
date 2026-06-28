import type { InputSectionDef } from "./types";

/** DD02 Intermediate Survey — vessel pre-docking sections. */
export const INTERMEDIATE_SURVEY_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "int_defects",
    label: "Defects",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["intermediate_survey"],
    mandatory: true,
    fields: [
      { key: "openDefects", label: "Open defects", type: "textarea", required: true },
      { key: "criticalRepairs", label: "Critical repairs", type: "textarea" },
      { key: "photosNote", label: "Photos", type: "photos_note" },
    ],
  },
  {
    key: "int_hull",
    label: "Hull",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["intermediate_survey"],
    fields: [
      { key: "hullFouling", label: "Hull fouling", type: "textarea" },
      { key: "paintCondition", label: "Paint condition", type: "textarea" },
      { key: "seaChestCondition", label: "Sea chest condition", type: "textarea" },
    ],
  },
  {
    key: "int_machinery",
    label: "Machinery",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["intermediate_survey"],
    mandatory: true,
    fields: [
      { key: "overduePms", label: "Overdue PMS", type: "textarea" },
      { key: "runningHours", label: "Running hours summary", type: "textarea" },
      { key: "leakageAbnormality", label: "Leakage / abnormality", type: "textarea" },
    ],
  },
  {
    key: "int_certificates",
    label: "Certificates",
    pageKey: "vessel",
    moduleId: "documents",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["intermediate_survey"],
    fields: [
      { key: "dueCertificates", label: "Due certificates", type: "textarea" },
      { key: "classRecommendations", label: "Class recommendations", type: "textarea" },
    ],
  },
  {
    key: "int_valves",
    label: "Sea valves",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["intermediate_survey"],
    fields: [
      { key: "valvesDueInspection", label: "Sea valves due for inspection", type: "textarea" },
    ],
  },
];
