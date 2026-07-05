import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileCheck,
  FileText,
  Flag,
  FolderOpen,
  GitBranch,
  Hammer,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Paperclip,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

/** Shipyard execution portal — separate from superintendent (/projects) module. */

export type ShipyardModuleSection =
  | "dashboard"
  | "projects"
  | "workshops"
  | "planning"
  | "execution"
  | "collaboration"
  | "commercial"
  | "reports";

export interface ShipyardNavLink {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export interface ShipyardNavSection {
  id: ShipyardModuleSection;
  label: string;
  href: string;
  icon: LucideIcon;
  items: ShipyardNavLink[];
}

/** Top-level shipyard dropdown (main app nav). */
export const shipyardNavChildren = [
  { href: "/shipyard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shipyard/projects", label: "Active projects", icon: FolderOpen },
  { href: "/shipyard/workshops", label: "Workshops", icon: Wrench },
  { href: "/shipyard/planning", label: "Planning", icon: CalendarRange },
  { href: "/shipyard/execution/jobs", label: "Job board", icon: ClipboardList },
  { href: "/shipyard/tender", label: "Tender & quotes", icon: FileText },
  { href: "/shipyard/reports", label: "Reports", icon: BarChart3 },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: LucideIcon }>;

/** Secondary sidebar inside /shipyard/* — workshop execution structure. */
export const shipyardModuleSections: ShipyardNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/shipyard",
    icon: LayoutDashboard,
    items: [],
  },
  {
    id: "projects",
    label: "Projects",
    href: "/shipyard/projects",
    icon: FolderOpen,
    items: [
      { href: "/shipyard/projects", label: "Active projects", icon: FolderOpen },
      { href: "/shipyard/projects/milestones", label: "Milestones", icon: Flag },
    ],
  },
  {
    id: "workshops",
    label: "Workshops",
    href: "/shipyard/workshops",
    icon: Wrench,
    items: [
      { href: "/shipyard/workshops", label: "Workshop overview", icon: Wrench },
      { href: "/shipyard/workshops/docking-team", label: "Docking team", icon: Anchor },
      { href: "/shipyard/workshops/hull", label: "Hull", icon: Hammer },
      { href: "/shipyard/workshops/steel", label: "Steel", icon: Hammer },
      { href: "/shipyard/workshops/painting", label: "Painting", icon: Wrench },
      { href: "/shipyard/workshops/machinery", label: "Machinery", icon: Wrench },
      { href: "/shipyard/workshops/valve", label: "Valve", icon: Wrench },
      { href: "/shipyard/workshops/electrical", label: "Electrical", icon: Zap },
      { href: "/shipyard/workshops/safety-qa", label: "Safety / QA-QC", icon: ShieldCheck },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    href: "/shipyard/planning",
    icon: CalendarRange,
    items: [
      { href: "/shipyard/planning", label: "Master schedule", icon: CalendarRange },
      { href: "/shipyard/planning/dependencies", label: "Dependencies", icon: GitBranch },
      { href: "/shipyard/planning/resources", label: "Resources", icon: Users },
    ],
  },
  {
    id: "execution",
    label: "Execution",
    href: "/shipyard/execution/jobs",
    icon: Hammer,
    items: [
      { href: "/shipyard/execution/jobs", label: "Job board", icon: ClipboardList },
      { href: "/shipyard/execution/progress", label: "Daily progress", icon: BarChart3 },
      { href: "/shipyard/execution/delays", label: "Delay register", icon: Clock },
      { href: "/shipyard/execution/permits", label: "Permit register", icon: FileCheck },
      { href: "/shipyard/execution/inspections", label: "Inspection register", icon: ClipboardCheck },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    href: "/shipyard/collaboration/clarifications",
    icon: MessageSquare,
    items: [
      { href: "/shipyard/collaboration/clarifications", label: "Clarifications", icon: MessageSquare },
      { href: "/shipyard/collaboration/attachments", label: "Attachments", icon: Paperclip },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    href: "/shipyard/commercial/variations",
    icon: Receipt,
    items: [
      { href: "/shipyard/tender", label: "Tender & RFQ", icon: FileText },
      { href: "/shipyard/tender/invites", label: "Yard invites", icon: Mail },
      { href: "/shipyard/yards", label: "Shipyard directory", icon: Building2 },
      { href: "/shipyard/commercial/variations", label: "Variation orders", icon: Receipt },
      { href: "/shipyard/commercial/work-done", label: "Work done", icon: ClipboardCheck },
      { href: "/shipyard/commercial/completion", label: "Final completion", icon: FileCheck },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/shipyard/reports",
    icon: BarChart3,
    items: [{ href: "/shipyard/reports", label: "Project reports", icon: BarChart3 }],
  },
];

export function shipyardSectionForPath(pathname: string): ShipyardNavSection {
  for (const section of shipyardModuleSections) {
    if (section.id === "dashboard" && pathname === "/shipyard") return section;
    if (section.id !== "dashboard" && pathname.startsWith(section.href.split("/").slice(0, 3).join("/"))) {
      return section;
    }
  }
  if (pathname.startsWith("/shipyard/tender") || pathname.startsWith("/shipyard/yards")) {
    return shipyardModuleSections.find((s) => s.id === "commercial")!;
  }
  return shipyardModuleSections[0]!;
}
