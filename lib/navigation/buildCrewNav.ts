import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock,
  Compass,
  Eye,
  Package,
  Pencil,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { CREW_ASSIGNABLE_PAGES, type CrewPageDefinition } from "@/lib/shipAccess/crewPages";
import type { ShipAccessNavItem } from "@/lib/navigation/shipAccessNavItems";
import type { TopNavChild, TopNavItem } from "@/lib/navigation/topNavItems";
import { Ship } from "lucide-react";

const CREW_PAGE_ICONS: Record<string, LucideIcon> = {
  "page.shipAccess.dashboard": Compass,
  "page.shipAccess.machineryDashboard": Clock,
  "page.shipAccess.machineryHours": Clock,
  "page.shipAccess.machineryRunningHours": Clock,
  "page.shipAccess.machineryParameters": Clock,
  "page.shipAccess.machineryCondition": Clock,
  "page.shipAccess.dryDockDashboard": PlusCircle,
  "page.shipAccess.dryDockJobs": Eye,
  "page.shipAccess.dryDockJobs.new": PlusCircle,
  "page.shipAccess.defects.new": PlusCircle,
  "page.shipAccess.defects.edit": Pencil,
  "page.shipAccess.defects": Eye,
  "page.shipAccess.defects.masterReview": ShieldCheck,
  "page.shipAccess.jobs.new": PlusCircle,
  "page.shipAccess.jobs.edit": Pencil,
  "page.shipAccess.jobs": Eye,
  "page.shipAccess.purchase": Package,
  "page.shipAccess.purchase.new": PlusCircle,
  "page.shipAccess.purchase.edit": Pencil,
  "page.shipAccess.purchase.masterReview": ShieldCheck,
  "page.shipAccess.pms": Clock,
};

function navHrefForPage(page: CrewPageDefinition): string {
  if (page.key === "page.shipAccess.jobs.edit") {
    return "/ship-access/dry-dock/jobs?status=draft";
  }
  if (page.key === "page.shipAccess.defects.edit") {
    return "/ship-access/defects?status=draft";
  }
  if (page.key === "page.shipAccess.defects.masterReview") {
    return "/ship-access/defects?status=submitted";
  }
  if (page.key === "page.shipAccess.purchase.edit") {
    return "/ship-access/purchase?status=draft";
  }
  if (page.key === "page.shipAccess.purchase.masterReview") {
    return "/ship-access/purchase?status=submitted";
  }
  return page.route;
}

function toNavItem(page: CrewPageDefinition): ShipAccessNavItem {
  return {
    href: navHrefForPage(page),
    label: page.label,
    description: page.description,
    icon: CREW_PAGE_ICONS[page.key] ?? AlertTriangle,
  };
}

export function buildShipAccessNavItems(assignedPageKeys: string[]): ShipAccessNavItem[] {
  const allowed = new Set(assignedPageKeys);
  return CREW_ASSIGNABLE_PAGES.filter((page) => allowed.has(page.key)).map(toNavItem);
}

export function buildCrewNavChildren(assignedPageKeys: string[]): TopNavChild[] {
  return buildShipAccessNavItems(assignedPageKeys);
}

export function buildCrewTopNavItems(assignedPageKeys: string[]): TopNavItem[] {
  const children = buildCrewNavChildren(assignedPageKeys);
  if (children.length === 0) return [];

  const firstHref = children[0]?.href ?? "/ship-access";
  return [
    {
      id: "shipAccess",
      label: "Onboard",
      href: firstHref,
      description: "Assigned onboard features for your vessel",
      icon: Ship,
      tier: "priority",
      children,
    },
  ];
}

export function crewHasPageAccess(assignedPageKeys: string[], permissionKey: string): boolean {
  return assignedPageKeys.includes(permissionKey);
}
