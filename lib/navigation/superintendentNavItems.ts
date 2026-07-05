import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Anchor,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  Flag,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";

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
  | "vesselRequisitionBank"
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
  icon: LucideIcon;
}

/** Technical Superintendent module sidebar navigation. */
export const superintendentNavItems: SuperintendentNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/superintendent",
    description: "Fleet dry-dock overview and KPIs",
    group: "Overview",
    icon: LayoutDashboard,
  },
  {
    id: "vessels",
    label: "Assigned vessels",
    href: "/superintendent/vessels",
    description: "Vessels in your scope with readiness scores",
    group: "Overview",
    icon: Anchor,
  },
  {
    id: "projects",
    label: "Dry dock projects",
    href: "/superintendent/projects",
    description: "Active and planned dry dock executions",
    group: "Planning",
    icon: FolderKanban,
  },
  {
    id: "checklist",
    label: "Pre-dock checklist",
    href: "/superintendent/planning/checklist",
    description: "Readiness tasks before yard entry",
    group: "Planning",
    icon: ListChecks,
  },
  {
    id: "milestones",
    label: "Milestones",
    href: "/superintendent/planning/milestones",
    description: "Key dates and gate reviews",
    group: "Planning",
    icon: Flag,
  },
  {
    id: "risks",
    label: "Risk register",
    href: "/superintendent/planning/risks",
    description: "Identified risks and mitigations",
    group: "Planning",
    icon: AlertTriangle,
  },
  {
    id: "jobs",
    label: "Job list",
    href: "/superintendent/jobs",
    description: "Scope jobs by category and status",
    group: "Jobs",
    icon: ClipboardList,
  },
  {
    id: "vesselJobBank",
    label: "Vessel job bank",
    href: "/superintendent/vessel-jobs",
    description: "Ship-proposed jobs awaiting superintendent curation",
    group: "Jobs",
    icon: Inbox,
  },
  {
    id: "budget",
    label: "Budget lines",
    href: "/superintendent/budget",
    description: "Budget vs quoted vs actual by category",
    group: "Budget",
    icon: Wallet,
  },
  {
    id: "variations",
    label: "Variation orders",
    href: "/superintendent/budget/variations",
    description: "VO tracking and approval status",
    group: "Budget",
    icon: FileText,
  },
  {
    id: "rfq",
    label: "Tender & RFQ",
    href: "/superintendent/rfq",
    description: "Linked tender projects and yard quotes",
    group: "RFQ",
    icon: FileText,
  },
  {
    id: "dailyReports",
    label: "Daily reports",
    href: "/superintendent/monitoring/daily-reports",
    description: "Yard daily progress and manpower",
    group: "Monitoring",
    icon: CalendarDays,
  },
  {
    id: "delays",
    label: "Delays",
    href: "/superintendent/monitoring/delays",
    description: "Open delay items and impact days",
    group: "Monitoring",
    icon: Clock,
  },
  {
    id: "progress",
    label: "Progress tracker",
    href: "/superintendent/monitoring/progress",
    description: "Overall project completion trends",
    group: "Monitoring",
    icon: TrendingUp,
  },
  {
    id: "survey",
    label: "Class surveys",
    href: "/superintendent/survey",
    description: "Survey items and class references",
    group: "Survey",
    icon: ClipboardCheck,
  },
  {
    id: "vesselRequisitionBank",
    label: "Vessel requisition bank",
    href: "/superintendent/vessel-requisitions",
    description: "Master-approved spares requisitions from the vessel portal",
    group: "Spares",
    icon: Inbox,
  },
  {
    id: "spares",
    label: "Spares & stores",
    href: "/superintendent/spares",
    description: "Required parts and delivery status",
    group: "Spares",
    icon: Package,
  },
  {
    id: "approvals",
    label: "Approval requests",
    href: "/superintendent/approvals",
    description: "Pending budget, scope, and VO approvals",
    group: "Approvals",
    icon: CheckCircle,
  },
  {
    id: "reports",
    label: "Reports & export",
    href: "/superintendent/reports",
    description: "Summary reports and Excel exports",
    group: "Reports",
    icon: FileSpreadsheet,
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
  if (pathname.startsWith("/superintendent/vessel-requisitions")) return "vesselRequisitionBank";
  if (pathname.startsWith("/superintendent/spares")) return "spares";
  if (pathname.startsWith("/superintendent/approvals")) return "approvals";
  if (pathname.startsWith("/superintendent/reports")) return "reports";
  return "dashboard";
}
