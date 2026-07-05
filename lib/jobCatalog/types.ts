/** JSON payloads stored on JobDynamicTemplate — aligned with spreadsheet tab 02. */

export type JobFormSectionDef = {
  key: string;
  label: string;
  sortOrder: number;
};

export type JobAutoFillFieldDef = {
  key: string;
  label: string;
  source: "vessel" | "machinery" | "project";
  path: string;
};

export type JobManualInputFieldDef = {
  key: string;
  label: string;
  type: string;
  section: string;
  required?: boolean;
  unit?: string;
  options?: { value: string; label: string }[];
};

export type JobRequiredPhotoDef = {
  slot: string;
  label: string;
  mandatory: boolean;
};

export type JobRequiredAttachmentDef = {
  key: string;
  label: string;
  type: string;
  mandatory: boolean;
};

export type JobDynamicTemplatePayload = {
  templateId: string;
  templateKey: string;
  templateName: string;
  formSections: JobFormSectionDef[];
  autoFillFields: JobAutoFillFieldDef[];
  manualInputFields: JobManualInputFieldDef[];
  requiredPhotos: JobRequiredPhotoDef[];
  requiredAttachments: JobRequiredAttachmentDef[];
  measurementSetId: string | null;
  checklistId: string | null;
  approvalWorkflowId: string;
};

export const STANDARD_FORM_SECTIONS: JobFormSectionDef[] = [
  { key: "condition", label: "Condition & Inspection", sortOrder: 1 },
  { key: "repair", label: "Repair Scope", sortOrder: 2 },
  { key: "risk", label: "Risk Assessment", sortOrder: 3 },
  { key: "approval", label: "Approval & Sign-off", sortOrder: 4 },
];

export const STANDARD_ME_APPROVAL_WORKFLOW_ID = "WF-ENG-ME-STANDARD";

export const AUTO_FILL_LABELS: Record<string, { label: string; source: JobAutoFillFieldDef["source"]; path: string }> = {
  "vessel.name": { label: "Vessel name", source: "vessel", path: "name" },
  "vessel.imo": { label: "IMO number", source: "vessel", path: "imo" },
  "machinery.runningHours": { label: "Running hours", source: "machinery", path: "runningHours" },
  "machinery.lastOverhaul": { label: "Last overhaul date", source: "machinery", path: "lastOverhaul" },
  "machinery.maker": { label: "Maker", source: "machinery", path: "maker" },
  "machinery.model": { label: "Model", source: "machinery", path: "model" },
  "machinery.serialNumber": { label: "Serial number", source: "machinery", path: "serialNumber" },
};

export const PHOTO_SLOT_LABELS: Record<string, string> = {
  before: "Before work",
  during: "During work",
  after: "After work",
  defect: "Defect detail",
  report: "Report / certificate",
};
