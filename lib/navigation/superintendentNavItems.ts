export type SuperintendentNavId =
  | "overview"
  | "dashboard"
  | "vessels"
  | "projects"
  | "checklist"
  | "milestones"
  | "risks"
  | "jobs"
  | "vesselJobBank"
  | "budget"
  | "variations"
  | "rfq"
  | "dailyReports"
  | "delays"
  | "progress"
  | "survey"
  | "spares"
  | "approvals"
  | "reports";

export type SuperintendentNavGroup =
  | "Overview"
  | "Planning"
  | "Jobs"
  | "Budget"
  | "RFQ"
  | "Monitoring"
  | "Survey"
  | "Spares"
  | "Approvals"
  | "Reports";

export interface SuperintendentNavItem {
  id: SuperintendentNavId;
  label: string;
  href: string;
  description: string;
  group: SuperintendentNavGroup;
}

/** Technical Superintendent module sidebar navigation. */
export const superintendentNavItems: SuperintendentNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/superintendent",
    description: "Fleet dry-dock overview and KPIs",
    group: "Overview",
  },
  {
    id: "vessels",
    label: "Assigned vessels",
    href: "/superintendent/vessels",
    description: "Vessels in your scope with readiness scores",
    group: "Overview",
  },
  {
    id: "projects",
    label: "Dry dock projects",
    href: "/superintendent/projects",
    description: "Active and planned dry dock executions",
    group: "Planning",
  },
  {
    id: "checklist",
    label: "Pre-dock checklist",
    href: "/superintendent/planning/checklist",
    description: "Readiness tasks before yard entry",
    group: "Planning",
  },
  {
    id: "milestones",
    label: "Milestones",
    href: "/superintendent/planning/milestones",
    description: "Key dates and gate reviews",
    group: "Planning",
  },
  {
    id: "risks",
    label: "Risk register",
    href: "/superintendent/planning/risks",
    description: "Identified risks and mitigations",
    group: "Planning",
  },
  {
    id: "jobs",
    label: "Job list",
    href: "/superintendent/jobs",
    description: "Scope jobs by category and status",
    group: "Jobs",
  },
  {
    id: "vesselJobBank",
    label: "Vessel job bank",
    href: "/superintendent/vessel-jobs",
    description: "Ship-proposed jobs awaiting superintendent curation",
    group: "Jobs",
  },
  {
    id: "budget",
    label: "Budget lines",
    href: "/superintendent/budget",
    description: "Budget vs quoted vs actual by category",
    group: "Budget",
  },
  {
    id: "variations",
    label: "Variation orders",
    href: "/superintendent/budget/variations",
    description: "VO tracking and approval status",
    group: "Budget",
  },
  {
    id: "rfq",
    label: "Tender & RFQ",
    href: "/superintendent/rfq",
    description: "Linked tender projects and yard quotes",
    group: "RFQ",
  },
  {
    id: "dailyReports",
    label: "Daily reports",
    href: "/superintendent/monitoring/daily-reports",
    description: "Yard daily progress and manpower",
    group: "Monitoring",
  },
  {
    id: "delays",
    label: "Delays",
    href: "/superintendent/monitoring/delays",
    description: "Open delay items and impact days",
    group: "Monitoring",
  },
  {
    id: "progress",
    label: "Progress tracker",
    href: "/superintendent/monitoring/progress",
    description: "Overall project completion trends",
    group: "Monitoring",
  },
  {
    id: "survey",
    label: "Class surveys",
    href: "/superintendent/survey",
    description: "Survey items and class references",
    group: "Survey",
  },
  {
    id: "spares",
    label: "Spares & stores",
    href: "/superintendent/spares",
    description: "Required parts and delivery status",
    group: "Spares",
  },
  {
    id: "approvals",
    label: "Approval requests",
    href: "/superintendent/approvals",
    description: "Pending budget, scope, and VO approvals",
    group: "Approvals",
  },
  {
    id: "reports",
    label: "Reports & export",
    href: "/superintendent/reports",
    description: "Summary reports and Excel exports",
    group: "Reports",
  },
];

export const superintendentNavGroups: SuperintendentNavGroup[] = [
  "Overview",
  "Planning",
  "Jobs",
  "Budget",
  "RFQ",
  "Monitoring",
  "Survey",
  "Spares",
  "Approvals",
  "Reports",
];

export function resolveSuperintendentNavId(pathname: string): SuperintendentNavId {
  if (pathname.startsWith("/superintendent/vessels")) return "vessels";
  if (pathname.startsWith("/superintendent/projects")) return "projects";
  if (pathname.startsWith("/superintendent/planning/checklist")) return "checklist";
  if (pathname.startsWith("/superintendent/planning/milestones")) return "milestones";
  if (pathname.startsWith("/superintendent/planning/risks")) return "risks";
  if (pathname.startsWith("/superintendent/vessel-jobs")) return "vesselJobBank";
  if (pathname.startsWith("/superintendent/jobs")) return "jobs";
  if (pathname.startsWith("/superintendent/budget/variations")) return "variations";
  if (pathname.startsWith("/superintendent/budget")) return "budget";
  if (pathname.startsWith("/superintendent/rfq")) return "rfq";
  if (pathname.startsWith("/superintendent/monitoring/daily-reports")) return "dailyReports";
  if (pathname.startsWith("/superintendent/monitoring/delays")) return "delays";
  if (pathname.startsWith("/superintendent/monitoring/progress")) return "progress";
  if (pathname.startsWith("/superintendent/survey")) return "survey";
  if (pathname.startsWith("/superintendent/spares")) return "spares";
  if (pathname.startsWith("/superintendent/approvals")) return "approvals";
  if (pathname.startsWith("/superintendent/reports")) return "reports";
  return "dashboard";
}
