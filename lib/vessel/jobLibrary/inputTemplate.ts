export type JobInputFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "measurement"
  | "photos_note";

export type JobInputFieldDef = {
  key: string;
  label: string;
  type: JobInputFieldType;
  required?: boolean;
  unit?: string;
  options?: { value: string; label: string }[];
  section?: "condition" | "repair" | "risk" | "approval";
};

export const STANDARD_JOB_INPUT_TEMPLATE: JobInputFieldDef[] = [
  { key: "conditionDescription", label: "Condition description", type: "textarea", required: true, section: "condition" },
  { key: "observedDefect", label: "Observed defect", type: "textarea", section: "condition" },
  { key: "runningHours", label: "Running hours at survey", type: "number", section: "condition" },
  { key: "lastOverhaul", label: "Last overhaul date", type: "date", section: "condition" },
  { key: "measurements", label: "Measurements", type: "measurement", section: "condition" },
  { key: "photosNote", label: "Photos / videos", type: "photos_note", section: "condition" },
  { key: "repairRecommendation", label: "Repair recommendation", type: "textarea", required: true, section: "repair" },
  { key: "replacementParts", label: "Replacement parts", type: "textarea", section: "repair" },
  { key: "consumables", label: "Consumables", type: "textarea", section: "repair" },
  { key: "estimatedManhours", label: "Estimated manhours", type: "number", section: "repair" },
  { key: "estimatedCost", label: "Estimated cost (USD)", type: "number", section: "repair" },
  { key: "classAttendance", label: "Class attendance required", type: "boolean", section: "repair" },
  { key: "makerAttendance", label: "Maker attendance required", type: "boolean", section: "repair" },
  { key: "operationalRisk", label: "Operational risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "safetyRisk", label: "Safety risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "environmentalRisk", label: "Environmental risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "criticality", label: "Criticality", type: "select", section: "risk", options: [
    { value: "routine", label: "Routine" }, { value: "important", label: "Important" }, { value: "critical", label: "Critical" },
  ]},
];
