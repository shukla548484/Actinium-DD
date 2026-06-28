import type { InputSectionDef } from "./types";

const ALL_TYPES = [
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
] as const;

/** Superintendent-entered sections — common across project types. */
export const SUPERINTENDENT_COMMON_SECTIONS: InputSectionDef[] = [
  {
    key: "su_scope_approval",
    label: "Scope approval",
    pageKey: "superintendent",
    moduleId: "scope",
    enteredBy: "superintendent",
    approvedBy: "superintendent",
    projectTypes: [...ALL_TYPES],
    mandatory: true,
    fields: [
      { key: "finalJobList", label: "Final job list confirmed", type: "boolean", required: true },
      { key: "mandatoryJobs", label: "Mandatory jobs", type: "textarea" },
      { key: "optionalJobs", label: "Optional jobs", type: "textarea" },
      { key: "priorityNotes", label: "Priority notes", type: "textarea" },
    ],
  },
  {
    key: "su_budget_plan",
    label: "Budget plan",
    pageKey: "superintendent",
    moduleId: "budget",
    enteredBy: "superintendent",
    projectTypes: [...ALL_TYPES],
    mandatory: true,
    fields: [
      { key: "estimatedTotal", label: "Estimated total", type: "number" },
      { key: "contingencyPct", label: "Contingency %", type: "number", unit: "%" },
      { key: "approvalLevel", label: "Approval level required", type: "text" },
      { key: "ownerSupplyNote", label: "Owner supply items", type: "textarea" },
      { key: "yardSupplyNote", label: "Yard supply items", type: "textarea" },
    ],
  },
  {
    key: "su_yard_selection",
    label: "Yard selection",
    pageKey: "superintendent",
    moduleId: "rfq",
    enteredBy: "superintendent",
    projectTypes: [...ALL_TYPES],
    fields: [
      { key: "invitedYards", label: "Invited yards", type: "textarea" },
      { key: "evaluationCriteria", label: "Evaluation criteria", type: "textarea" },
      { key: "quoteDeadline", label: "Quote deadline", type: "date" },
    ],
  },
];

/** DD01 Special Survey — superintendent sections. */
export const SPECIAL_SURVEY_SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  {
    key: "su_ss_survey_plan",
    label: "Survey planning",
    pageKey: "superintendent",
    moduleId: "survey",
    enteredBy: "superintendent",
    projectTypes: ["special_survey"],
    mandatory: true,
    fields: [
      { key: "classSurveyItems", label: "Class survey items", type: "textarea", required: true },
      { key: "statutoryItems", label: "Statutory survey items", type: "textarea" },
      { key: "holdPoints", label: "Hold points", type: "textarea" },
    ],
  },
  {
    key: "su_ss_technical_decisions",
    label: "Technical decisions",
    pageKey: "superintendent",
    moduleId: "scope",
    enteredBy: "superintendent",
    projectTypes: ["special_survey"],
    fields: [
      { key: "tailshaftWithdrawal", label: "Tailshaft withdrawal required", type: "boolean" },
      { key: "propellerWork", label: "Propeller work scope", type: "textarea" },
      { key: "steelRenewalAllowance", label: "Steel renewal allowance", type: "text", unit: "kg" },
    ],
  },
  {
    key: "su_ss_paint_scheme",
    label: "Paint scheme approval",
    pageKey: "superintendent",
    moduleId: "scope",
    enteredBy: "superintendent",
    projectTypes: ["special_survey"],
    fields: [
      { key: "paintMaker", label: "Approved paint maker", type: "text" },
      { key: "coatingSystem", label: "Coating system", type: "textarea" },
      { key: "dftRequirement", label: "DFT requirement", type: "text", unit: "µm" },
      { key: "warrantyRequirement", label: "Warranty requirement", type: "textarea" },
    ],
  },
];

export const DAMAGE_REPAIR_SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  {
    key: "su_dr_repair_scope",
    label: "Repair scope",
    pageKey: "superintendent",
    moduleId: "scope",
    enteredBy: "superintendent",
    projectTypes: ["damage_repair"],
    mandatory: true,
    fields: [
      { key: "permanentRepair", label: "Permanent repair requirement", type: "textarea", required: true },
      { key: "classRequirement", label: "Class requirement", type: "textarea" },
      { key: "insuranceClaim", label: "Insurance / claim reference", type: "text" },
      { key: "ownerInsuranceSplit", label: "Owner / insurance cost split", type: "textarea" },
      { key: "priority", label: "Priority", type: "select", options: [
        { value: "emergency", label: "Emergency" },
        { value: "urgent", label: "Urgent" },
        { value: "planned", label: "Planned" },
      ]},
    ],
  },
];

export const UNDERWATER_SURVEY_SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  {
    key: "su_uw_scope",
    label: "Survey scope",
    pageKey: "superintendent",
    moduleId: "survey",
    enteredBy: "superintendent",
    projectTypes: ["underwater_survey"],
    mandatory: true,
    fields: [
      { key: "classApprovedScope", label: "Class-approved UWILD scope", type: "textarea", required: true },
      { key: "divingCompany", label: "Approved diving company", type: "text" },
      { key: "classSurveyor", label: "Class surveyor details", type: "text" },
      { key: "acceptanceCriteria", label: "Photo / video requirement", type: "textarea" },
      { key: "budgetEstimate", label: "Diving and class cost estimate", type: "number" },
    ],
  },
];

export const EMERGENCY_DOCKING_SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  {
    key: "su_em_approval",
    label: "Emergency approval",
    pageKey: "superintendent",
    moduleId: "approvals",
    enteredBy: "superintendent",
    projectTypes: ["emergency_docking"],
    mandatory: true,
    fields: [
      { key: "managementApproval", label: "Management approval ref", type: "text", required: true },
      { key: "nearestYard", label: "Nearest suitable yard", type: "text" },
      { key: "emergencyBudget", label: "Emergency budget", type: "number" },
      { key: "insuranceHandling", label: "Insurance / claim handling", type: "textarea" },
      { key: "classRequirement", label: "Immediate class requirement", type: "textarea" },
    ],
  },
];

export const WARRANTY_REPAIR_SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  {
    key: "su_wr_claim",
    label: "Warranty claim",
    pageKey: "superintendent",
    moduleId: "approvals",
    enteredBy: "superintendent",
    projectTypes: ["warranty_repair"],
    mandatory: true,
    fields: [
      { key: "claimNumber", label: "Claim number", type: "text" },
      { key: "makerCommunication", label: "Maker communication ref", type: "text" },
      { key: "responsibility", label: "Owner / maker / yard responsibility", type: "textarea" },
      { key: "costAllocation", label: "Chargeable / FOC / shared", type: "select", options: [
        { value: "foc", label: "Free of charge" },
        { value: "chargeable", label: "Chargeable" },
        { value: "shared", label: "Shared" },
      ]},
    ],
  },
];

export const SUPERINTENDENT_SECTIONS: InputSectionDef[] = [
  ...SUPERINTENDENT_COMMON_SECTIONS,
  ...SPECIAL_SURVEY_SUPERINTENDENT_SECTIONS,
  ...DAMAGE_REPAIR_SUPERINTENDENT_SECTIONS,
  ...UNDERWATER_SURVEY_SUPERINTENDENT_SECTIONS,
  ...EMERGENCY_DOCKING_SUPERINTENDENT_SECTIONS,
  ...WARRANTY_REPAIR_SUPERINTENDENT_SECTIONS,
];
