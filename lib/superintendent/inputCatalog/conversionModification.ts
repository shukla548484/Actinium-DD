import type { InputSectionDef } from "./types";

/** DD09 Conversion / Modification — vessel sections. */
export const CONVERSION_MODIFICATION_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "conv_existing",
    label: "Existing arrangement",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["conversion_modification"],
    mandatory: true,
    fields: [
      { key: "drawingsNote", label: "Drawings / photos refs", type: "photos_note" },
      { key: "currentCondition", label: "Current condition", type: "textarea", required: true },
    ],
  },
  {
    key: "conv_requirement",
    label: "Operational requirement",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["conversion_modification"],
    mandatory: true,
    fields: [
      { key: "changeNeeded", label: "What change is needed", type: "textarea", required: true },
      { key: "constraints", label: "Space / cargo / stability / power constraints", type: "textarea" },
      { key: "relatedDefects", label: "Related existing defects", type: "textarea" },
    ],
  },
];
