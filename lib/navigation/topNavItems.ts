import type { LucideIcon } from "lucide-react";
import { Anchor, Building2, ClipboardList, Compass, Settings, Ship, ShoppingCart } from "lucide-react";
import { shipAccessNavChildren } from "@/lib/navigation/shipAccessNavItems";
import { shipyardNavChildren } from "@/lib/navigation/shipyardNavItems";
import { superintendentNavItems } from "@/lib/navigation/superintendentNavItems";

export type TopNavId =
  | "admin"
  | "jobs"
  | "shipyard"
  | "shipAccess"
  | "purchase"
  | "company"
  | "superintendent"
  | "tasks";

export interface TopNavChild {
  href: string;
  label: string;
  description?: string;
}

export interface TopNavSection {
  title?: string;
  items: TopNavChild[];
}

export interface TopNavItem {
  id: TopNavId;
  label: string;
  href?: string;
  description?: string;
  icon: LucideIcon;
  tier: "priority" | "secondary";
  sections?: TopNavSection[];
  children?: TopNavChild[];
}

/** Actinium-DD portal modules — app-specific top navigation. */
export const topNavItems: TopNavItem[] = [
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    description: "Organization, catalog & access control",
    icon: Settings,
    tier: "priority",
    children: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/companies", label: "Companies" },
      { href: "/admin/vessels", label: "Vessels" },
      { href: "/admin/employees", label: "Employees" },
      { href: "/admin/master-catalog", label: "Master catalog" },
      { href: "/admin/roles", label: "Roles" },
      { href: "/admin/access", label: "Page access" },
    ],
  },
  {
    id: "jobs",
    label: "Job Creations",
    href: "/projects",
    description: "Dry-dock tender projects",
    icon: Ship,
    tier: "priority",
    children: [
      { href: "/projects", label: "All projects" },
      { href: "/projects/new", label: "New project" },
    ],
  },
  {
    id: "shipyard",
    label: "Shipyard",
    href: "/shipyard",
    description: "Workshop execution, planning & daily progress",
    icon: Anchor,
    tier: "priority",
    children: [...shipyardNavChildren],
  },
  {
    id: "shipAccess",
    label: "Ship Access",
    href: "/ship-access",
    description: "Onboard portal — propose dry dock scope jobs",
    icon: Compass,
    tier: "priority",
    children: [...shipAccessNavChildren],
  },
  {
    id: "purchase",
    label: "Purchase Module",
    href: "/projects",
    description: "Tender specs, yard invites & comparison",
    icon: ShoppingCart,
    tier: "priority",
    children: [
      { href: "/projects", label: "Tender projects" },
      { href: "/projects/new", label: "New tender" },
    ],
  },
  {
    id: "company",
    label: "Company",
    href: "/admin/companies",
    description: "Fleet company & vessel scope",
    icon: Building2,
    tier: "priority",
    children: [
      { href: "/admin/companies", label: "Company management" },
      { href: "/admin/vessels", label: "Vessel management" },
      { href: "/admin/employees", label: "Employee management" },
    ],
  },
  {
    id: "superintendent",
    label: "Tech Superintendent",
    href: "/superintendent",
    description: "Dry dock planning, jobs, budget & monitoring",
    icon: ClipboardList,
    tier: "priority",
    children: superintendentNavItems.map((item) => ({
      href: item.href,
      label: item.label,
      description: item.description,
    })),
  },
];

export const priorityNavItems = topNavItems.filter((i) => i.tier === "priority");

export const tasksNavItem = {
  id: "tasks" as const,
  label: "Tasks Pending",
  href: "/projects",
  description: "Open tenders & yard responses",
};

export function resolveActiveNavId(pathname: string): TopNavId {
  if (pathname.startsWith("/ship-access")) return "shipAccess";
  if (pathname.startsWith("/superintendent")) return "superintendent";
  if (pathname.startsWith("/shipyard")) return "shipyard";
  if (pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/vessels")) {
    return "company";
  }
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/projects/new") return "jobs";
  if (pathname.includes("yards") || pathname.includes("comparison")) return "purchase";
  if (pathname.startsWith("/projects")) return "jobs";
  return "company";
}

export function isTopNavItemActive(pathname: string, item: TopNavItem): boolean {
  const links = [
    ...(item.children ?? []),
    ...(item.sections?.flatMap((s) => s.items) ?? []),
    ...(item.href ? [{ href: item.href, label: "" }] : []),
  ];

  return links.some((link) => {
    if (link.href === "/admin") return pathname === "/admin";
    if (link.href === "/shipyard") return pathname === "/shipyard";
    if (link.href === "/ship-access") return pathname === "/ship-access";
    if (link.href === "/projects" || link.href === "/shipyard/jobs") {
      return pathname === link.href || pathname.startsWith(`${link.href}/`);
    }
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  });
}

export function getTopNavSections(item: TopNavItem): TopNavSection[] {
  if (item.children?.length) return [{ items: item.children }];
  if (item.sections?.length) {
    return [{ items: item.sections.flatMap((s) => s.items) }];
  }
  return [];
}
