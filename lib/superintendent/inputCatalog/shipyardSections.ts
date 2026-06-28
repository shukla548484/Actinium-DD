import type { InputSectionDef } from "./types";

/** Shipyard-entered sections (entered via superintendent or yard portal). */
export const SHIPYARD_COMMON_SECTIONS: InputSectionDef[] = [
  {
    key: "sy_work_plan",
    label: "Work plan",
    pageKey: "workshop",
    moduleId: "workshops",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "damage_repair",
      "occasional_repair",
      "new_installation",
      "emergency_docking",
      "layup_reactivation",
      "conversion_modification",
      "warranty_repair",
    ],
    fields: [
      { key: "dockSchedule", label: "Dock schedule", type: "textarea" },
      { key: "workshopAllocation", label: "Workshop allocation", type: "textarea" },
      { key: "milestones", label: "Key milestones", type: "textarea" },
    ],
  },
  {
    key: "sy_resources",
    label: "Resources",
    pageKey: "workshop",
    moduleId: "resources",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "damage_repair",
      "new_installation",
      "emergency_docking",
      "conversion_modification",
    ],
    fields: [
      { key: "manpower", label: "Manpower plan", type: "textarea" },
      { key: "craneStaging", label: "Crane / staging", type: "textarea" },
      { key: "ventilationDehumidifier", label: "Ventilation / dehumidifier", type: "textarea" },
    ],
  },
  {
    key: "sy_progress",
    label: "Progress update",
    pageKey: "workshop",
    moduleId: "daily_progress",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "damage_repair",
      "occasional_repair",
      "new_installation",
      "emergency_docking",
      "layup_reactivation",
      "conversion_modification",
      "warranty_repair",
    ],
    fields: [
      { key: "dailyProgress", label: "Daily progress summary", type: "textarea" },
      { key: "delayReason", label: "Delay reason (if any)", type: "textarea" },
      { key: "completionProof", label: "Completion evidence refs", type: "photos_note" },
    ],
  },
];

export const DAMAGE_REPAIR_SHIPYARD_SECTIONS: InputSectionDef[] = [
  {
    key: "sy_dr_assessment",
    label: "Damage assessment",
    pageKey: "workshop",
    moduleId: "shipyard",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: ["damage_repair"],
    mandatory: true,
    fields: [
      { key: "yardInspectionReport", label: "Yard inspection report", type: "textarea", required: true },
      { key: "repairMethod", label: "Repair method (crop/renew, welding…)", type: "textarea" },
      { key: "emergencyTimeline", label: "Emergency repair timeline", type: "textarea" },
      { key: "additionalDamage", label: "Additional damage found", type: "textarea" },
    ],
  },
];

export const UNDERWATER_SURVEY_SHIPYARD_SECTIONS: InputSectionDef[] = [
  {
    key: "sy_uw_dive",
    label: "Dive plan & findings",
    pageKey: "workshop",
    moduleId: "survey",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: ["underwater_survey"],
    mandatory: true,
    fields: [
      { key: "divePlan", label: "Divers, equipment, safety plan", type: "textarea", required: true },
      { key: "surveyEvidence", label: "Photos / videos refs", type: "photos_note" },
      { key: "findings", label: "Hull / propeller / rudder / sea chest findings", type: "textarea" },
      { key: "repairsDone", label: "Cleaning / rope removal / minor repair", type: "textarea" },
      { key: "signedReport", label: "Signed survey report ref", type: "text" },
    ],
  },
];

export const SHIPYARD_SECTIONS: InputSectionDef[] = [
  ...SHIPYARD_COMMON_SECTIONS,
  ...DAMAGE_REPAIR_SHIPYARD_SECTIONS,
  ...UNDERWATER_SURVEY_SHIPYARD_SECTIONS,
];
