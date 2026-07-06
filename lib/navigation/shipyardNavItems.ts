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
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldCheck,
  UserCircle,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { SHIPYARD_MODULES, type ShipyardModuleId } from "@/lib/shipyard/workflow";

/** Shipyard ERP portal — left nav follows yard lifecycle (RFQ → award → execution → closeout). */

export type ShipyardModuleSection = ShipyardModuleId;

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

const MODULE_ICONS: Record<ShipyardModuleId, LucideIcon> = {
  dashboard: LayoutDashboard,
  profile: UserCircle,
  rfq_inbox: Inbox,
  cost_estimation: BarChart3,
  internal_approval: ClipboardCheck,
  quote_builder: FileText,
  awarded_projects: FolderOpen,
  project_planning: CalendarRange,
  resource_allocation: Users,
  material_planning: Package,
  daily_progress: BarChart3,
  variation_orders: Receipt,
  workshop_production: Wrench,
  qa_qc: ShieldCheck,
  billing: Receipt,
  project_closeout: FileCheck,
};

function sectionFromModule(id: ShipyardModuleId): ShipyardNavSection {
  const mod = SHIPYARD_MODULES.find((m) => m.id === id)!;
  return {
    id,
    label: mod.label,
    href: mod.href,
    icon: MODULE_ICONS[id],
    items: [],
  };
}

function sectionWithItems(
  id: ShipyardModuleId,
  items: ShipyardNavLink[],
): ShipyardNavSection {
  const base = sectionFromModule(id);
  return { ...base, items };
}

/** Top-level shipyard dropdown (main app nav). */
export const shipyardNavChildren = [
  { href: "/shipyard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shipyard/rfq", label: "RFQ inbox", icon: Inbox },
  { href: "/shipyard/awarded", label: "Awarded projects", icon: FolderOpen },
  { href: "/shipyard/planning", label: "Planning", icon: CalendarRange },
  { href: "/shipyard/workshops", label: "Workshops", icon: Wrench },
  { href: "/shipyard/profile", label: "Yard profile", icon: Building2 },
] as const satisfies ReadonlyArray<{ href: string; label: string; icon: LucideIcon }>;

/**
 * Left sidebar — matches shipyard workflow lifecycle.
 * @see lib/shipyard/workflow.ts SHIPYARD_MODULE_BUILD_ORDER
 */
export const shipyardModuleSections: ShipyardNavSection[] = [
  sectionFromModule("dashboard"),
  sectionFromModule("profile"),
  sectionFromModule("rfq_inbox"),
  sectionFromModule("cost_estimation"),
  sectionFromModule("internal_approval"),
  sectionFromModule("quote_builder"),
  sectionFromModule("awarded_projects"),
  sectionWithItems("project_planning", [
    { href: "/shipyard/planning", label: "Master schedule", icon: CalendarRange },
    { href: "/shipyard/planning/dependencies", label: "Dependencies & critical path", icon: GitBranch },
    { href: "/shipyard/planning/resources", label: "Resource allocation", icon: Users },
  ]),
  sectionFromModule("material_planning"),
  sectionFromModule("daily_progress"),
  sectionFromModule("variation_orders"),
  sectionWithItems("workshop_production", [
    { href: "/shipyard/workshops", label: "Workshop overview", icon: Wrench },
    { href: "/shipyard/workshops/docking-team", label: "Docking team", icon: Anchor },
    { href: "/shipyard/workshops/hull", label: "Hull", icon: Hammer },
    { href: "/shipyard/workshops/steel", label: "Steel", icon: Hammer },
    { href: "/shipyard/workshops/painting", label: "Painting", icon: Wrench },
    { href: "/shipyard/workshops/machinery", label: "Machinery", icon: Wrench },
    { href: "/shipyard/workshops/valve", label: "Valve", icon: Wrench },
    { href: "/shipyard/workshops/electrical", label: "Electrical", icon: Zap },
    { href: "/shipyard/workshops/safety-qa", label: "Safety / QA-QC", icon: ShieldCheck },
  ]),
  sectionWithItems("qa_qc", [
    { href: "/shipyard/qa", label: "QA overview", icon: ShieldCheck },
    { href: "/shipyard/execution/inspections", label: "Inspection register", icon: ClipboardCheck },
  ]),
  sectionFromModule("billing"),
  sectionFromModule("project_closeout"),
];

export function shipyardSectionForPath(pathname: string): ShipyardNavSection {
  if (pathname === "/shipyard") {
    return shipyardModuleSections.find((s) => s.id === "dashboard")!;
  }

  const pathMatches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  for (const section of shipyardModuleSections) {
    if (pathMatches(section.href)) return section;
    for (const item of section.items) {
      if (pathMatches(item.href)) return section;
    }
  }

  if (pathname.startsWith("/shipyard/tender")) {
    return shipyardModuleSections.find((s) => s.id === "rfq_inbox")!;
  }
  if (pathname.startsWith("/shipyard/projects")) {
    return shipyardModuleSections.find((s) => s.id === "awarded_projects")!;
  }
  if (pathname.startsWith("/shipyard/execution")) {
    if (pathname.includes("progress")) {
      return shipyardModuleSections.find((s) => s.id === "daily_progress")!;
    }
    return shipyardModuleSections.find((s) => s.id === "workshop_production")!;
  }
  if (pathname.startsWith("/shipyard/commercial")) {
    if (pathname.includes("variations")) {
      return shipyardModuleSections.find((s) => s.id === "variation_orders")!;
    }
    return shipyardModuleSections.find((s) => s.id === "project_closeout")!;
  }

  return shipyardModuleSections[0]!;
}
