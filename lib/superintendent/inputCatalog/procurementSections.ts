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

/** Procurement / spares input sections (page 7). */
export const PROCUREMENT_SECTIONS: InputSectionDef[] = [
  {
    key: "proc_required_spares",
    label: "Required spares",
    pageKey: "procurement",
    moduleId: "procurement",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    approvedBy: "purchase",
    projectTypes: [...ALL_TYPES],
    mandatory: true,
    fields: [
      { key: "spareList", label: "Required spares list", type: "textarea", required: true },
      { key: "linkedJobs", label: "Linked jobs", type: "textarea" },
      { key: "quantityNotes", label: "Quantities", type: "textarea" },
    ],
  },
  {
    key: "proc_onboard_availability",
    label: "Onboard availability",
    pageKey: "procurement",
    moduleId: "spares",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: [...ALL_TYPES],
    fields: [
      { key: "onboardAvailable", label: "Available onboard", type: "textarea" },
      { key: "robNote", label: "ROB / stock notes", type: "textarea" },
      { key: "ownerSupply", label: "Owner supply items", type: "textarea" },
      { key: "yardSupply", label: "Yard supply items", type: "textarea" },
    ],
  },
  {
    key: "proc_delivery_tracking",
    label: "Delivery status",
    pageKey: "procurement",
    moduleId: "procurement",
    enteredBy: "purchase",
    reviewedBy: "superintendent",
    projectTypes: [...ALL_TYPES],
    fields: [
      { key: "pendingDelivery", label: "Pending delivery items", type: "textarea" },
      { key: "expectedDeliveryDate", label: "Expected delivery date", type: "date" },
      { key: "poReferences", label: "PO references", type: "textarea" },
      { key: "vendorQuotes", label: "Vendor quote refs", type: "textarea" },
    ],
  },
  {
    key: "proc_rfq_terms",
    label: "RFQ & terms",
    pageKey: "procurement",
    moduleId: "rfq",
    enteredBy: "superintendent",
    reviewedBy: "superintendent",
    projectTypes: [
      "special_survey",
      "intermediate_survey",
      "new_installation",
      "conversion_modification",
    ],
    fields: [
      { key: "vendorList", label: "Vendor / yard list", type: "textarea" },
      { key: "quoteDeadline", label: "Quote deadline", type: "date" },
      { key: "termsExclusions", label: "Terms & exclusions", type: "textarea" },
    ],
  },
];
