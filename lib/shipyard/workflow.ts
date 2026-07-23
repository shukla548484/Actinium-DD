/**
 * Shipyard portal lifecycle — left navigation order and RFQ → execution flow.
 * @see docs/shipyard/PORTAL-ERP-PLAN.md
 */

export const SHIPYARD_ERP_HIERARCHY = [
  "Shipyard",
  "Project",
  "Contract",
  "RFQ",
  "Quotation",
  "WorkPackage",
  "Job",
  "Activity",
  "Task",
  "DailyProgress",
] as const;

export type ShipyardErpLevel = (typeof SHIPYARD_ERP_HIERARCHY)[number];

/** Pre-award RFQ workflow (office → shipyard queue). */
export const YARD_RFQ_WORKFLOW_STAGES = [
  { key: "received", label: "Receive RFQ", order: 1 },
  { key: "review", label: "Review RFQ", order: 2 },
  { key: "assign_estimator", label: "Assign Estimator", order: 3 },
  { key: "cost_estimate", label: "Prepare Cost Estimate", order: 4 },
  { key: "internal_approval", label: "Internal Approval", order: 5 },
  { key: "submit_quotation", label: "Submit Quotation", order: 6 },
  { key: "award_received", label: "Award Received", order: 7 },
] as const;

export type YardRfqWorkflowStage = (typeof YARD_RFQ_WORKFLOW_STAGES)[number]["key"];

/** Post-award execution workflow. */
export const YARD_EXECUTION_WORKFLOW_STAGES = [
  { key: "project_planning", label: "Project Planning", order: 8 },
  { key: "allocate_resources", label: "Allocate Resources", order: 9 },
  { key: "execute_jobs", label: "Execute Jobs", order: 10 },
  { key: "daily_progress", label: "Daily Progress", order: 11 },
  { key: "variation_orders", label: "Variation Orders", order: 12 },
  { key: "qc_inspection", label: "QC Inspection", order: 13 },
  { key: "invoice", label: "Invoice", order: 14 },
  { key: "project_closeout", label: "Project Closeout", order: 15 },
] as const;

export type YardExecutionWorkflowStage = (typeof YARD_EXECUTION_WORKFLOW_STAGES)[number]["key"];

export type YardWorkflowStage = YardRfqWorkflowStage | YardExecutionWorkflowStage;

export type ShipyardModuleId =
  | "dashboard"
  | "profile"
  | "rfq_inbox"
  | "cost_estimation"
  | "internal_approval"
  | "quote_builder"
  | "awarded_projects"
  | "project_planning"
  | "resource_allocation"
  | "material_planning"
  | "daily_progress"
  | "variation_orders"
  | "workshop_production"
  | "qa_qc"
  | "billing"
  | "project_closeout";

export type ShipyardModuleDef = {
  id: ShipyardModuleId;
  label: string;
  href: string;
  phase: "pre_award" | "post_award" | "foundation";
  workflowStages: YardWorkflowStage[];
  description: string;
  /** Prisma tables this module will own or extend. */
  dbTables: string[];
  /** Planned API route prefixes. */
  apiPrefixes: string[];
  /** build = scaffolded, partial = some data, live = production-ready */
  status: "planned" | "scaffold" | "partial" | "live";
};

/** Recommended build order (matches shipyard operational sequence). */
export const SHIPYARD_MODULE_BUILD_ORDER: ShipyardModuleId[] = [
  "dashboard",
  "profile",
  "rfq_inbox",
  "cost_estimation",
  "internal_approval",
  "quote_builder",
  "awarded_projects",
  "project_planning",
  "workshop_production",
  "daily_progress",
  "variation_orders",
  "qa_qc",
  "billing",
  "project_closeout",
  "resource_allocation",
  "material_planning",
];

export const SHIPYARD_MODULES: ShipyardModuleDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/shipyard",
    phase: "foundation",
    workflowStages: [],
    description: "KPIs, timeline, critical jobs, variation and invoice summary.",
    dbTables: ["yard_work_projects", "workshop_jobs", "yard_invites"],
    apiPrefixes: ["/api/shipyard/dashboard"],
    status: "live",
  },
  {
    id: "profile",
    label: "Shipyard Profile",
    href: "/shipyard/profile",
    phase: "foundation",
    workflowStages: [],
    description: "General info, docks, workshops, cranes, equipment, capacity calendar.",
    dbTables: ["companies", "yard_profiles", "yard_docks", "yard_facilities", "yard_cranes", "yard_capacity_slots"],
    apiPrefixes: ["/api/shipyard/profile"],
    status: "partial",
  },
  {
    id: "rfq_inbox",
    label: "RFQ Inbox",
    href: "/shipyard/rfq",
    phase: "pre_award",
    workflowStages: ["received", "review", "assign_estimator"],
    description: "RFQs received from owner when office issues tender invites.",
    dbTables: ["yard_invites", "projects", "spec_lines"],
    apiPrefixes: ["/api/shipyard/rfq", "/api/shipyard/quotations"],
    status: "live",
  },
  {
    id: "cost_estimation",
    label: "Cost Estimation",
    href: "/shipyard/estimation",
    phase: "pre_award",
    workflowStages: ["cost_estimate"],
    description: "Per-job labour, material, equipment, margin roll-up.",
    dbTables: ["yard_cost_estimates", "yard_cost_estimate_lines", "yard_general_service_items", "yard_cost_templates"],
    apiPrefixes: ["/api/shipyard/estimation"],
    status: "partial",
  },
  {
    id: "internal_approval",
    label: "Internal Approval",
    href: "/shipyard/approvals",
    phase: "pre_award",
    workflowStages: ["internal_approval"],
    description: "Estimator → Commercial Manager → GM sign-off before quote submission.",
    dbTables: ["yard_approval_steps"],
    apiPrefixes: ["/api/shipyard/approvals"],
    status: "scaffold",
  },
  {
    id: "quote_builder",
    label: "Quote Builder",
    href: "/shipyard/quotation",
    phase: "pre_award",
    workflowStages: ["submit_quotation"],
    description: "Vessel-job quotation workspace: pricing, T&Cs, and tariff snapshots.",
    dbTables: [
      "shipyard_quotation_requests",
      "shipyard_quotation_request_jobs",
      "shipyard_quotation_lines",
      "shipyard_quotation_terms",
      "shipyard_tariff_schedules",
    ],
    apiPrefixes: ["/api/shipyard/quotation", "/api/shipyard/quotations", "/api/shipyard/tariffs", "/api/quote"],
    status: "live",
  },
  {
    id: "awarded_projects",
    label: "Awarded Projects",
    href: "/shipyard/awarded",
    phase: "post_award",
    workflowStages: ["award_received"],
    description: "Won contracts — current, upcoming, delayed, completed.",
    dbTables: ["yard_work_projects", "yard_invites"],
    apiPrefixes: ["/api/shipyard/awarded"],
    status: "scaffold",
  },
  {
    id: "project_planning",
    label: "Project Planning",
    href: "/shipyard/planning",
    phase: "post_award",
    workflowStages: ["project_planning"],
    description: "Gantt, critical path, job schedule, dependencies.",
    dbTables: ["workshop_jobs", "workshop_job_dependencies"],
    apiPrefixes: ["/api/shipyard/projects", "/api/shipyard/planning"],
    status: "partial",
  },
  {
    id: "resource_allocation",
    label: "Resource Allocation",
    href: "/shipyard/planning/resources",
    phase: "post_award",
    workflowStages: ["allocate_resources"],
    description: "Trade crews, shifts, availability per project.",
    dbTables: ["yard_resource_allocations"],
    apiPrefixes: ["/api/shipyard/resources"],
    status: "scaffold",
  },
  {
    id: "material_planning",
    label: "Material Planning",
    href: "/shipyard/materials",
    phase: "post_award",
    workflowStages: ["project_planning"],
    description: "Steel, pipe, paint, consumables reservation before start.",
    dbTables: ["yard_material_plans"],
    apiPrefixes: ["/api/shipyard/materials"],
    status: "scaffold",
  },
  {
    id: "daily_progress",
    label: "Daily Progress",
    href: "/shipyard/execution/progress",
    phase: "post_award",
    workflowStages: ["daily_progress", "execute_jobs"],
    description: "Per-job % complete, delays, photos, remarks.",
    dbTables: ["yard_daily_progress"],
    apiPrefixes: ["/api/shipyard/projects/*/registers/progress"],
    status: "live",
  },
  {
    id: "variation_orders",
    label: "Variation Orders",
    href: "/shipyard/commercial/variations",
    phase: "post_award",
    workflowStages: ["variation_orders"],
    description: "Additional work discovered during docking.",
    dbTables: ["yard_variation_entries"],
    apiPrefixes: ["/api/shipyard/projects/*/registers/variations"],
    status: "live",
  },
  {
    id: "workshop_production",
    label: "Workshop Production",
    href: "/shipyard/workshops",
    phase: "post_award",
    workflowStages: ["execute_jobs"],
    description: "Per-department job queues (steel, pipe, paint, etc.).",
    dbTables: ["workshop_jobs"],
    apiPrefixes: ["/api/shipyard/jobs"],
    status: "live",
  },
  {
    id: "qa_qc",
    label: "QA / QC",
    href: "/shipyard/qa",
    phase: "post_award",
    workflowStages: ["qc_inspection"],
    description: "Inspection, punch list, acceptance, close per job.",
    dbTables: ["yard_inspection_entries"],
    apiPrefixes: ["/api/shipyard/projects/*/registers/inspections", "/api/shipyard/qa"],
    status: "partial",
  },
  {
    id: "billing",
    label: "Billing",
    href: "/shipyard/billing",
    phase: "post_award",
    workflowStages: ["invoice"],
    description: "Progress, additional work, and final invoices.",
    dbTables: ["yard_invoices"],
    apiPrefixes: ["/api/shipyard/billing"],
    status: "scaffold",
  },
  {
    id: "project_closeout",
    label: "Project Closeout",
    href: "/shipyard/closeout",
    phase: "post_award",
    workflowStages: ["project_closeout"],
    description: "Certificates, photos, completion report, archive.",
    dbTables: ["yard_closeout_checklists"],
    apiPrefixes: ["/api/shipyard/closeout"],
    status: "scaffold",
  },
];

export function shipyardModuleById(id: ShipyardModuleId): ShipyardModuleDef | undefined {
  return SHIPYARD_MODULES.find((m) => m.id === id);
}

export function shipyardModuleForPath(pathname: string): ShipyardModuleDef {
  const match = [...SHIPYARD_MODULES]
    .filter((m) => m.id !== "dashboard")
    .sort((a, b) => b.href.length - a.href.length)
    .find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
  if (match) return match;
  if (pathname === "/shipyard") return shipyardModuleById("dashboard")!;
  return shipyardModuleById("dashboard")!;
}

/** Map legacy invite status → yard workflow stage (until workflowStage column is populated). */
export function inferWorkflowStageFromInvite(status: string): YardRfqWorkflowStage {
  switch (status) {
    case "invited":
      return "received";
    case "in_progress":
      return "review";
    case "submitted":
    case "excel_imported":
      return "submit_quotation";
    case "shortlisted":
      return "internal_approval";
    case "accepted":
      return "award_received";
    case "rejected":
      return "review";
    default:
      return "received";
  }
}
