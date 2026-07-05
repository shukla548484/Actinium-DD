import type { RbacUserType } from "@prisma/client";
import { Anchor, Building2, Compass, LayoutDashboard, Settings, Ship } from "lucide-react";
import type { TopNavItem } from "@/lib/navigation/topNavItems";
import { topNavItems } from "@/lib/navigation/topNavItems";
import { shipyardNavChildren } from "@/lib/navigation/shipyardNavItems";
import { externalNavChildren } from "@/lib/navigation/externalNavItems";

const OFFICE_NAV_IDS = new Set<TopNavItem["id"]>([
  "admin",
  "jobs",
  "purchase",
  "company",
  "superintendent",
]);

/** Top navigation filtered by RBAC user type. */
export function buildTopNavForUserType(userType: RbacUserType): TopNavItem[] {
  switch (userType) {
    case "system":
      return topNavItems;
    case "office":
      return topNavItems.filter((item) => OFFICE_NAV_IDS.has(item.id));
    case "shipyard":
      return [
        {
          id: "shipyard",
          label: "Shipyard",
          href: "/shipyard",
          description: "Dockyard execution portal",
          icon: Anchor,
          tier: "priority",
          children: shipyardNavChildren.map((item) => ({
            href: item.href,
            label: item.label,
            icon: item.icon,
          })),
        },
      ];
    case "external":
      return [
        {
          id: "jobs",
          label: "External",
          href: "/external",
          description: "Vendor and external party portal",
          icon: Building2,
          tier: "priority",
          children: externalNavChildren.map((item) => ({
            href: item.href,
            label: item.label,
            icon: item.icon,
          })),
        },
      ];
    case "vessel":
      return [];
    default:
      return topNavItems.filter((item) => OFFICE_NAV_IDS.has(item.id));
  }
}

export function portalHomeHrefForUserType(userType: RbacUserType): string {
  switch (userType) {
    case "system":
      return "/admin";
    case "office":
      return "/projects";
    case "vessel":
      return "/ship-access";
    case "shipyard":
      return "/shipyard";
    case "external":
      return "/external";
    default:
      return "/projects";
  }
}

export const PORTAL_HUB_ENTRIES = [
  {
    userType: "system" as const,
    title: "System",
    description: "Platform administration and access control",
    href: "/admin",
    icon: Settings,
  },
  {
    userType: "office" as const,
    title: "Office",
    description: "Fleet, superintendent, and tender projects",
    href: "/projects",
    icon: Ship,
  },
  {
    userType: "vessel" as const,
    title: "Vessel",
    description: "Onboard crew — defects, jobs, machinery",
    href: "/ship-access",
    icon: Compass,
  },
  {
    userType: "shipyard" as const,
    title: "Shipyard",
    description: "Dockyard workshops, planning, and execution",
    href: "/shipyard",
    icon: Anchor,
  },
  {
    userType: "external" as const,
    title: "External",
    description: "Vendors, makers, class, and other external parties",
    href: "/external",
    icon: Building2,
  },
] as const;

export function resolveActiveNavIdForUserType(
  pathname: string,
  userType: RbacUserType,
): TopNavItem["id"] {
  if (userType === "vessel") return "shipAccess";
  if (userType === "shipyard") return "shipyard";
  if (userType === "external") {
    return pathname.startsWith("/external") ? "jobs" : "jobs";
  }
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
