import type { YardRegisterType } from "@/lib/shipyard/registerTypes";

export type RegisterFieldType = "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "job";

export interface RegisterFieldDef {
  name: string;
  label: string;
  type: RegisterFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface RegisterConfig {
  title: string;
  description: string;
  fields: RegisterFieldDef[];
  columns: { key: string; header: string }[];
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CLARIFICATION_STATUS = [
  { value: "open", label: "Open" },
  { value: "awaiting_owner", label: "Awaiting owner" },
  { value: "awaiting_class", label: "Awaiting class" },
  { value: "resolved", label: "Resolved" },
];

const PERMIT_TYPES = [
  { value: "hot_work", label: "Hot work" },
  { value: "enclosed_space", label: "Enclosed space" },
  { value: "height_work", label: "Height work" },
  { value: "other", label: "Other" },
];

const INSPECTION_RESULTS = [
  { value: "pending", label: "Pending" },
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "conditional", label: "Conditional" },
];

const ATTACHMENT_TYPES = [
  { value: "photo", label: "Photo" },
  { value: "document", label: "Document" },
  { value: "drawing", label: "Drawing" },
  { value: "certificate", label: "Certificate" },
];

const VISIBILITY_OPTIONS = [
  { value: "internal", label: "Internal yard" },
  { value: "owner", label: "Owner visible" },
  { value: "class", label: "Class visible" },
];

const ISSUE_TYPES = [
  { value: "Technical clarification", label: "Technical clarification" },
  { value: "Material shortage", label: "Material shortage" },
  { value: "Class hold point", label: "Class hold point" },
  { value: "Safety issue", label: "Safety issue" },
  { value: "Variation work", label: "Variation work" },
  { value: "Access required", label: "Access required" },
];

export const REGISTER_CONFIG: Record<YardRegisterType, RegisterConfig> = {
  "daily-progress": {
    title: "Daily progress",
    description: "Workshop supervisors log progress %, manpower, and shift notes.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "reportDate", label: "Date", type: "date", required: true },
      { name: "progressPct", label: "Progress %", type: "number" },
      { name: "manpowerCount", label: "Manpower", type: "number" },
      { name: "updatedBy", label: "Updated by", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      { key: "reportDate", header: "Date" },
      { key: "job", header: "Job" },
      { key: "progressPct", header: "Progress" },
      { key: "manpowerCount", header: "Manpower" },
      { key: "updatedBy", header: "Updated by" },
    ],
  },
  delays: {
    title: "Delay register",
    description: "Weather, material, access, class, and owner delays.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "delayReason", label: "Delay reason", type: "text", required: true },
      { name: "sinceDate", label: "Since", type: "date" },
      { name: "impactDays", label: "Impact (days)", type: "number" },
      { name: "ownerAction", label: "Owner action", type: "text" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "job", header: "Job" },
      { key: "delayReason", header: "Reason" },
      { key: "sinceDate", header: "Since" },
      { key: "impactDays", header: "Impact" },
      { key: "status", header: "Status" },
    ],
  },
  permits: {
    title: "Permit register",
    description: "Hot work, enclosed space, and height permits.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "permitNo", label: "Permit no.", type: "text" },
      { name: "permitType", label: "Type", type: "select", options: PERMIT_TYPES },
      { name: "validFrom", label: "Valid from", type: "date" },
      { name: "validTo", label: "Valid to", type: "date" },
      { name: "safetyOfficer", label: "Safety officer", type: "text" },
      { name: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    ],
    columns: [
      { key: "permitNo", header: "Permit" },
      { key: "job", header: "Job" },
      { key: "permitType", header: "Type" },
      { key: "validTo", header: "Valid to" },
      { key: "status", header: "Status" },
    ],
  },
  inspections: {
    title: "Inspection register",
    description: "QA-QC and class hold points with inspection results.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "holdPoint", label: "Hold point", type: "text" },
      { name: "inspector", label: "Inspector", type: "text" },
      { name: "plannedDate", label: "Planned", type: "date" },
      { name: "completedDate", label: "Completed", type: "date" },
      { name: "result", label: "Result", type: "select", options: INSPECTION_RESULTS },
      { name: "classComment", label: "Class comment", type: "textarea" },
    ],
    columns: [
      { key: "job", header: "Job" },
      { key: "holdPoint", header: "Hold point" },
      { key: "result", header: "Result" },
      { key: "completedDate", header: "Completed" },
    ],
  },
  clarifications: {
    title: "Clarifications",
    description: "Workshop issues with owner replies and class comments.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "refNo", label: "Reference", type: "text" },
      { name: "issueType", label: "Issue type", type: "select", options: ISSUE_TYPES },
      { name: "raisedBy", label: "Raised by", type: "text" },
      { name: "actionBy", label: "Action by", type: "text" },
      { name: "body", label: "Issue", type: "textarea", required: true },
      { name: "ownerReply", label: "Owner reply", type: "textarea" },
      { name: "classComment", label: "Class comment", type: "textarea" },
      { name: "internalNotes", label: "Internal notes", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: CLARIFICATION_STATUS },
    ],
    columns: [
      { key: "refNo", header: "Ref" },
      { key: "job", header: "Job" },
      { key: "issueType", header: "Type" },
      { key: "status", header: "Status" },
      { key: "ownerReply", header: "Owner reply" },
    ],
  },
  variations: {
    title: "Variation orders",
    description: "Growth work requiring superintendent approval.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "voNumber", label: "VO no.", type: "text" },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "raisedBy", label: "Raised by", type: "text" },
      { name: "commercialImpact", label: "Commercial impact (USD)", type: "number" },
      { name: "ownerStatus", label: "Owner status", type: "select", options: STATUS_OPTIONS },
      { name: "approved", label: "Approved", type: "checkbox" },
    ],
    columns: [
      { key: "voNumber", header: "VO" },
      { key: "job", header: "Job" },
      { key: "description", header: "Description" },
      { key: "ownerStatus", header: "Owner status" },
      { key: "approved", header: "Approved" },
    ],
  },
  attachments: {
    title: "Attachments",
    description: "Photos, drawings, and certificates linked to jobs.",
    fields: [
      { name: "workshopJobId", label: "Job", type: "job" },
      { name: "attachmentType", label: "Type", type: "select", options: ATTACHMENT_TYPES },
      { name: "filename", label: "Filename", type: "text", required: true },
      { name: "fileUrl", label: "File URL", type: "text", required: true, placeholder: "https://… or /uploads/…" },
      { name: "uploadedBy", label: "Uploaded by", type: "text" },
      { name: "visibility", label: "Visibility", type: "select", options: VISIBILITY_OPTIONS },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    columns: [
      { key: "filename", header: "File" },
      { key: "job", header: "Job" },
      { key: "attachmentType", header: "Type" },
      { key: "visibility", header: "Visibility" },
    ],
  },
};

export function formatRegisterCell(key: string, entry: Record<string, unknown>): string {
  const job = entry.workshopJob as { jobCode?: string | null; jobTitle?: string } | null | undefined;
  switch (key) {
    case "job":
      return job ? `${job.jobCode ?? "—"} · ${job.jobTitle ?? ""}` : "—";
    case "reportDate":
    case "sinceDate":
    case "validTo":
    case "plannedDate":
    case "completedDate": {
      const v = entry[key];
      if (!v) return "—";
      return new Date(String(v)).toLocaleDateString("en-GB", { timeZone: "UTC" });
    }
    case "progressPct":
      return entry.progressPct != null ? `${Math.round(Number(entry.progressPct))}%` : "—";
    case "approved":
      return entry.approved ? "Yes" : "No";
    case "ownerReply":
    case "description": {
      const v = String(entry[key] ?? "");
      return v.length > 60 ? `${v.slice(0, 60)}…` : v || "—";
    }
    default:
      return entry[key] != null && entry[key] !== "" ? String(entry[key]) : "—";
  }
}
