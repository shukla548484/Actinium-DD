import type { InputSectionDef } from "./types";

/** DD08 Lay-up / Reactivation — vessel sections. */
export const LAYUP_REACTIVATION_VESSEL_SECTIONS: InputSectionDef[] = [
  {
    key: "lu_status",
    label: "Lay-up status",
    pageKey: "vessel",
    moduleId: "scope",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["layup_reactivation"],
    mandatory: true,
    fields: [
      { key: "layupType", label: "Cold / warm lay-up", type: "select", options: [
        { value: "cold", label: "Cold lay-up" },
        { value: "warm", label: "Warm lay-up" },
        { value: "reactivation", label: "Reactivation" },
      ], required: true },
      { key: "preservationCondition", label: "Machinery preservation condition", type: "textarea" },
    ],
  },
  {
    key: "lu_certificates",
    label: "Certificates & crew",
    pageKey: "vessel",
    moduleId: "documents",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["layup_reactivation"],
    fields: [
      { key: "expiredCertificates", label: "Expired certificates", type: "textarea" },
      { key: "manningLevel", label: "Crew / manning level", type: "text" },
    ],
  },
  {
    key: "lu_inventory",
    label: "Inventory & defects",
    pageKey: "vessel",
    moduleId: "spares",
    enteredBy: "vessel",
    reviewedBy: "superintendent",
    projectTypes: ["layup_reactivation"],
    fields: [
      { key: "sparesInventory", label: "Spares inventory", type: "textarea" },
      { key: "lubesChemicals", label: "Lubes / chemicals ROB", type: "textarea" },
      { key: "reactivationDefects", label: "Reactivation defects", type: "textarea" },
    ],
  },
];
