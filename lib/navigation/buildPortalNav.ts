import type { RbacUserType } from "@prisma/client";
import { Anchor, Building2, Compass, LayoutDashboard, Settings, Ship } from "lucide-react";
import type { TopNavChild, TopNavItem } from "@/lib/navigation/topNavItems";
import { topNavItems } from "@/lib/navigation/topNavItems";
import { shipyardNavChildren } from "@/lib/navigation/shipyardNavItems";
import { externalNavChildren } from "@/lib/navigation/externalNavItems";
import { ACCESS_MODULES } from "@/lib/rbac/accessModules";
import { pagePermissionForPath } from "@/lib/rbac/rolePermissions";

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

/**
 * Filter portal nav by assigned modules and pages.
 * SYS_ADMIN / unrestricted callers should pass `unrestricted: true`.
 */
export function filterTopNavByAssignments(
  items: TopNavItem[],
  options: {
    unrestricted?: boolean;
    assignedModuleCodes?: string[];
    assignedPageKeys?: string[];
  },
): TopNavItem[] {
  if (options.unrestricted) return items;

  const modules = new Set(options.assignedModuleCodes ?? []);
  const pages = new Set(options.assignedPageKeys ?? []);

  // No modules assigned → hide all portal modules.
  if (modules.size === 0) return [];

  const navIdToModule = new Map<string, string>();
  for (const mod of ACCESS_MODULES) {
    if (mod.navId) navIdToModule.set(mod.navId, mod.code);
  }

  return items
    .map((item) => {
      const moduleCode = navIdToModule.get(item.id);
      if (moduleCode && !modules.has(moduleCode)) return null;

      const filterChild = (child: TopNavChild) => {
        if (pages.size === 0) return false;
        const permission = pagePermissionForPath(child.href);
        if (!permission) return modules.has(moduleCode ?? "");
        return pages.has(permission);
      };

      const children = item.children?.filter(filterChild);
      const sections = item.sections
        ?.map((section) => ({
          ...section,
          items: section.items.filter(filterChild),
        }))
        .filter((section) => section.items.length > 0);

      const hasChildren = (children?.length ?? 0) > 0 || (sections?.length ?? 0) > 0;
      if (item.children || item.sections) {
        if (!hasChildren) return null;
        return { ...item, children, sections };
      }

      if (item.href) {
        const permission = pagePermissionForPath(item.href);
        if (permission && !pages.has(permission)) return null;
      }

      return item;
    })
    .filter((item): item is TopNavItem => item != null);
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
  if (pathname.startsWith("/purchase")) return "purchase";
  if (pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/vessels")) {
    return "company";
  }
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/projects/new") return "jobs";
  if (pathname.startsWith("/projects")) return "jobs";
  return "company";
}
