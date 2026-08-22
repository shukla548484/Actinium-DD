import type { RbacUserType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Building2,
  Compass,
  FileText,
  LayoutDashboard,
  List,
  Settings,
  Ship,
} from "lucide-react";
import type { TopNavChild, TopNavItem } from "@/lib/navigation/topNavItems";
import { topNavItems } from "@/lib/navigation/topNavItems";
import { shipyardNavChildren } from "@/lib/navigation/shipyardNavItems";
import { externalNavChildren } from "@/lib/navigation/externalNavItems";
import { ACCESS_MODULES, getAccessModule, moduleCodeForPageKey } from "@/lib/rbac/accessModules";
import { pagePermissionForPath } from "@/lib/rbac/rolePermissions";

const OFFICE_NAV_IDS = new Set<TopNavItem["id"]>([
  "admin",
  "jobs",
  "purchase",
  "company",
  "superintendent",
]);

/** Admin-monitor chrome — not for individual office roles (e.g. TECH_SUPDT). */
const ADMIN_MONITOR_NAV_IDS = new Set<TopNavItem["id"]>(["office"]);

/** Turn a catalog resource path into a top-nav href. */
export function resolveNavHrefFromRoute(route?: string | null): string | null {
  if (!route) return null;
  // Dynamic project tabs: /projects/[id]#overview → /projects
  if (route.includes("[")) {
    const base = route.slice(0, route.indexOf("[")).replace(/\/$/, "");
    return base || null;
  }
  if (route.includes("#")) {
    return route.split("#")[0] || null;
  }
  return route;
}

function iconForModule(moduleCode: string): LucideIcon {
  switch (moduleCode) {
    case "jobs":
      return Ship;
    case "purchase":
      return LayoutDashboard;
    case "admin":
    case "company":
      return Settings;
    case "office":
      return FileText;
    case "superintendent":
      return FileText;
    case "shipyard":
      return Anchor;
    case "shipAccess":
      return Compass;
    default:
      return List;
  }
}

/**
 * Build dropdown entries from assigned module pages so every assigned page
 * can appear in the module menu (not only a few hard-coded children).
 */
export function buildAssignedModuleNavChildren(
  moduleCode: string,
  assignedPageKeys: Iterable<string>,
  existingChildren?: TopNavChild[],
): TopNavChild[] {
  const pages = new Set(assignedPageKeys);
  const mod = getAccessModule(moduleCode);
  if (!mod || pages.size === 0) return [];

  const ordered: TopNavChild[] = [];
  const coveredKeys = new Set<string>();
  const seen = new Set<string>();

  const pushUnique = (child: TopNavChild, pageKey?: string) => {
    // Top nav is destination-based — never list the same href twice.
    if (seen.has(child.href)) return;
    seen.add(child.href);
    ordered.push(child);
    if (pageKey) coveredKeys.add(pageKey);
  };

  // 1) Keep rich static module menus (Purchase, Superintendent, …) when assigned.
  for (const child of existingChildren ?? []) {
    const permission = pagePermissionForPath(child.href);
    if (!permission || !pages.has(permission)) continue;
    pushUnique(child, permission);
  }

  // 2) Add assigned catalog pages that are real top-level destinations.
  // Skip project-scoped routes (/projects/[id]#…) — those are in-workspace tabs,
  // not global menu entries (collapsing them to /projects duplicated "All projects").
  const fallbackIcon = iconForModule(moduleCode);
  for (const page of mod.pages) {
    if (!pages.has(page.key) || coveredKeys.has(page.key)) continue;
    const rawRoute = page.route;
    if (!rawRoute || rawRoute.includes("[") || rawRoute.includes("#")) continue;
    const href = resolveNavHrefFromRoute(rawRoute);
    if (!href) continue;
    pushUnique(
      {
        href,
        label: page.label.replace(/\s+tab$/i, ""),
        description: page.description,
        icon: fallbackIcon,
      },
      page.key,
    );
  }

  return ordered;
}

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
 * Dropdown children are rebuilt from the access-module catalog so every
 * assigned page appears in the module menu.
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

  const pages = new Set(options.assignedPageKeys ?? []);
  const modules = new Set(options.assignedModuleCodes ?? []);

  // If only page keys are known, derive modules so parent nav items still appear.
  if (modules.size === 0 && pages.size > 0) {
    for (const key of pages) {
      const code = moduleCodeForPageKey(key);
      if (code) modules.add(code);
    }
  }

  if (modules.size === 0) return [];

  const navIdToModule = new Map<string, string>();
  for (const mod of ACCESS_MODULES) {
    if (mod.navId) navIdToModule.set(mod.navId, mod.code);
  }

  return items
    .map((item) => {
      // Office departments is admin monitor only — ignore accidental assignments.
      if (ADMIN_MONITOR_NAV_IDS.has(item.id)) return null;

      const moduleCode = navIdToModule.get(item.id);
      if (moduleCode && !modules.has(moduleCode)) return null;

      const filterChild = (child: TopNavChild) => {
        if (pages.size === 0) return false;
        const permission = pagePermissionForPath(child.href);
        if (!permission) return modules.has(moduleCode ?? "");
        return pages.has(permission);
      };

      let children = item.children?.filter(filterChild);
      let sections = item.sections
        ?.map((section) => ({
          ...section,
          items: section.items.filter(filterChild),
        }))
        .filter((section) => section.items.length > 0);

      if (moduleCode) {
        const catalogChildren = buildAssignedModuleNavChildren(
          moduleCode,
          pages,
          item.children,
        );
        if (catalogChildren.length > 0) {
          children = catalogChildren;
          sections = undefined;
        }
      }

      const hasChildren = (children?.length ?? 0) > 0 || (sections?.length ?? 0) > 0;
      if (item.children || item.sections || moduleCode) {
        if (!hasChildren) return null;
        const primaryHref = children?.[0]?.href ?? item.href;
        return { ...item, href: primaryHref, children, sections };
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
  if (pathname.startsWith("/office")) return "office";
  if (pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/vessels")) {
    return "company";
  }
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/projects/new") return "jobs";
  if (pathname === "/projects/archived") return "jobs";
  if (pathname.startsWith("/projects")) return "jobs";
  return "company";
}
