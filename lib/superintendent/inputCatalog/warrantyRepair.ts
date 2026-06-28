import type { InputSectionDef } from "./types";

/** DD10 Warranty Repair — vessel sections. */
export const WARRANTY_REPAIR_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "wr_evidence",
    label: "Defect evidence",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["warranty_repair"],
    mandatory: true,
    attachmentRequired: true,
    fields: [
      { key: "photosNote", label: "Photos / operating records", type: "photos_note", required: true },
      { key: "symptoms", label: "Failure symptoms", type: "textarea", required: true },
      { key: "runningHours", label: "Running hours", type: "number" },
      { key: "operationalImpact", label: "Operational impact", type: "textarea" },
    ],
  },
  {
    key: "wr_warranty_ref",
    label: "Warranty reference",
    pageKey: "vessel",
    moduleId: "documents",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["warranty_repair"],
    mandatory: true,
    fields: [
      { key: "equipment", label: "Equipment", type: "text", required: true },
      { key: "maker", label: "Maker", type: "text" },
      { key: "purchaseDate", label: "Purchase / delivery date", type: "date" },
      { key: "warrantyTerms", label: "Warranty terms ref", type: "text" },
    ],
  },
];
