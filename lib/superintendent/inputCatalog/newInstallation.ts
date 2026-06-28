import type { InputSectionDef } from "./types";

/** DD06 New Installation / Retrofit — vessel sections. */
export const NEW_INSTALLATION_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "ni_existing_system",
    label: "Existing system",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["new_installation"],
    mandatory: true,
    fields: [
      { key: "equipmentDetails", label: "Current equipment details", type: "textarea", required: true },
      { key: "maker", label: "Maker", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "capacity", label: "Capacity", type: "text" },
    ],
  },
  {
    key: "ni_space",
    label: "Installation space",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["new_installation"],
    fields: [
      { key: "areaPhotos", label: "Installation area photos", type: "photos_note" },
      { key: "availableSpace", label: "Available space notes", type: "textarea" },
    ],
  },
  {
    key: "ni_utilities",
    label: "Piping & electrical",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["new_installation"],
    fields: [
      { key: "pipeRouting", label: "Existing pipe routing", type: "textarea" },
      { key: "powerAvailability", label: "Power availability", type: "textarea" },
      { key: "switchboardDetails", label: "Switchboard details", type: "textarea" },
    ],
  },
  {
    key: "ni_operations",
    label: "Operational limitations",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["new_installation"],
    fields: [
      { key: "operationalLimits", label: "Operational limitations during install", type: "textarea" },
      { key: "documentsNote", label: "Drawings / manuals / certificates", type: "textarea" },
    ],
  },
];
