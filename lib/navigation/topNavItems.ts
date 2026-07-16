import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Building2,
  ClipboardList,
  Compass,
  List,
  PlusCircle,
  Settings,
  Ship,
  ShoppingCart,
} from "lucide-react";
import { adminNavItems } from "@/lib/navigation/adminNavItems";
import { purchaseNavItems } from "@/lib/navigation/purchaseNavItems";
import { shipAccessNavItems } from "@/lib/navigation/shipAccessNavItems";
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
  icon: LucideIcon;
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
    children: adminNavItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    })),
  },
  {
    id: "jobs",
    label: "Job Creations",
    href: "/projects",
    description: "Dry-dock tender projects",
    icon: Ship,
    tier: "priority",
    children: [
      { href: "/projects", label: "All projects", icon: List },
      { href: "/projects/new", label: "New project", icon: PlusCircle },
    ],
  },
  {
    id: "shipyard",
    label: "Shipyard",
    href: "/shipyard",
    description: "Workshop execution, planning & daily progress",
    icon: Anchor,
    tier: "priority",
    children: shipyardNavChildren.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    })),
  },
  {
    id: "shipAccess",
    label: "Ship Access",
    href: "/ship-access",
    description: "Onboard portal — propose dry dock scope jobs",
    icon: Compass,
    tier: "priority",
    children: shipAccessNavItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    })),
  },
  {
    id: "purchase",
    label: "Purchase",
    href: "/purchase/dashboard",
    description: "Requisitions, RFQ, quotes, POs, invoices & vendors",
    icon: ShoppingCart,
    tier: "priority",
    children: purchaseNavItems.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
    })),
  },
  {
    id: "company",
    label: "Company",
    href: "/admin/companies",
    description: "Fleet company & vessel scope",
    icon: Building2,
    tier: "priority",
    children: adminNavItems
      .filter((item) => ["companies", "vessels", "employees"].includes(item.id))
      .map((item) => ({
        href: item.href,
        label: item.label === "Companies" ? "Company management" : item.label === "Vessels" ? "Vessel management" : "Employee management",
        icon: item.icon,
      })),
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
      icon: item.icon,
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
  if (pathname.startsWith("/purchase")) return "purchase";
  if (pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/vessels")) {
    return "company";
  }
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/projects/new") return "jobs";
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
