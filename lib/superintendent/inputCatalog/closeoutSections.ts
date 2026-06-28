import type { InputSectionDef } from "./types";

const EXECUTION_TYPES = [
  "special_survey",
  "intermediate_survey",
  "damage_repair",
  "occasional_repair",
  "new_installation",
  "emergency_docking",
  "layup_reactivation",
  "conversion_modification",
  "warranty_repair",
] as const;

/** Closeout / completion input sections (page 9). */
export const CLOSEOUT_INPUT_SECTIONS: InputSectionDef[] = [
  {
    key: "co_completion_evidence",
    label: "Completion evidence",
    pageKey: "closeout",
    moduleId: "closeout",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: [...EXECUTION_TYPES],
    mandatory: true,
    attachmentRequired: true,
    fields: [
      { key: "completionStatus", label: "Completion status summary", type: "textarea", required: true },
      { key: "finalPhotos", label: "Final photos refs", type: "photos_note" },
      { key: "testResults", label: "Test / commissioning results", type: "textarea" },
    ],
  },
  {
    key: "co_qa_qc",
    label: "QA / QC",
    pageKey: "closeout",
    moduleId: "inspections",
    enteredBy: "shipyard",
    reviewedBy: "superintendent",
    projectTypes: [...EXECUTION_TYPES],
    fields: [
      { key: "qaQcReport", label: "QA/QC report ref", type: "text" },
      { key: "dftReadings", label: "DFT readings summary", type: "textarea" },
      { key: "pressureTestReports", label: "Pressure test reports", type: "textarea" },
    ],
  },
  {
    key: "co_class_approval",
    label: "Class approval",
    pageKey: "closeout",
    moduleId: "survey",
    enteredBy: "superintendent",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "damage_repair",
      "new_installation",
      "emergency_docking",
      "layup_reactivation",
      "conversion_modification",
    ],
    fields: [
      { key: "classApprovalStatus", label: "Class approval status", type: "textarea" },
      { key: "certificateUpdates", label: "Certificate updates", type: "textarea" },
      { key: "statutoryItems", label: "Statutory items closed", type: "textarea" },
    ],
  },
  {
    key: "co_warranty",
    label: "Warranty",
    pageKey: "closeout",
    moduleId: "closeout",
    enteredBy: "superintendent",
    reviewedBy: "superintendent",
    projectTypes: [...EXECUTION_TYPES],
    fields: [
      { key: "warrantyTerms", label: "Warranty terms", type: "textarea" },
      { key: "warrantyCertificate", label: "Warranty certificate ref", type: "text" },
      { key: "lessonsLearned", label: "Lessons learned", type: "textarea" },
    ],
  },
  {
    key: "co_commercial",
    label: "Commercial closeout",
    pageKey: "closeout",
    moduleId: "budget",
    enteredBy: "accounts",
    reviewedBy: "superintendent",
    projectTypes: [...EXECUTION_TYPES],
    fields: [
      { key: "finalInvoiceRef", label: "Final invoice ref", type: "text" },
      { key: "paymentStatus", label: "Payment status", type: "select", options: [
        { value: "pending", label: "Pending" },
        { value: "partial", label: "Partially paid" },
        { value: "paid", label: "Paid" },
      ]},
      { key: "finalCostNotes", label: "Final cost vs budget notes", type: "textarea" },
    ],
  },
];
