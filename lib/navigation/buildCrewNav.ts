import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Anchor,
  Clock,
  Compass,
  Eye,
  List,
  Package,
  Pencil,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import {
  CREW_ASSIGNABLE_PAGES,
  withMachineryRegisterPage,
  type CrewPageDefinition,
} from "@/lib/shipAccess/crewPages";
import type { ShipAccessNavItem } from "@/lib/navigation/shipAccessNavItems";
import type { TopNavChild, TopNavId, TopNavItem } from "@/lib/navigation/topNavItems";

const CREW_PAGE_ICONS: Record<string, LucideIcon> = {
  "page.shipAccess.dashboard": Compass,
  "page.shipAccess.machineryDashboard": Clock,
  "page.shipAccess.machineryHours": Clock,
  "page.shipAccess.machineryRunningHours": Clock,
  "page.shipAccess.machineryParameters": Clock,
  "page.shipAccess.machineryCondition": Clock,
  "page.shipAccess.machineryRegister": Clock,
  "page.shipAccess.dryDockDashboard": PlusCircle,
  "page.shipAccess.dryDockJobs": Eye,
  "page.shipAccess.dryDockJobs.new": PlusCircle,
  "page.shipAccess.simpleJobs": Eye,
  "page.shipAccess.simpleJobs.new": PlusCircle,
  "page.shipAccess.simpleJobs.edit": Pencil,
  "page.shipAccess.simpleJobs.masterReview": ShieldCheck,
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

/** Display groups for Ship Access top/sub navigation. */
export type ShipAccessNavGroupId =
  | "overview"
  | "machinery"
  | "dryDock"
  | "jobs"
  | "defectsRequisitions";

export type ShipAccessNavGroup = {
  id: ShipAccessNavGroupId;
  label: string;
  icon: LucideIcon;
  items: ShipAccessNavItem[];
};

const NAV_GROUP_META: Record<
  ShipAccessNavGroupId,
  { label: string; icon: LucideIcon; topNavId: TopNavId }
> = {
  overview: { label: "Vessel overview", icon: Compass, topNavId: "shipAccess" },
  machinery: { label: "Machinery", icon: Clock, topNavId: "shipAccessMachinery" },
  dryDock: { label: "Dry dock", icon: Anchor, topNavId: "shipAccessDryDock" },
  jobs: { label: "Jobs", icon: List, topNavId: "shipAccessJobs" },
  defectsRequisitions: {
    label: "Defects & requisitions",
    icon: AlertTriangle,
    topNavId: "shipAccessDefects",
  },
};

const NAV_GROUP_ORDER: ShipAccessNavGroupId[] = [
  "overview",
  "machinery",
  "dryDock",
  "jobs",
  "defectsRequisitions",
];

function navGroupForPage(page: CrewPageDefinition): ShipAccessNavGroupId {
  switch (page.group) {
    case "Overview":
      return "overview";
    case "Machinery":
      return "machinery";
    case "Dry dock scope":
    case "Dry dock jobs":
      return "dryDock";
    case "Jobs":
      return "jobs";
    case "Defects":
    case "Purchase":
      return "defectsRequisitions";
  }
}

function navHrefForPage(page: CrewPageDefinition): string {
  if (page.key === "page.shipAccess.simpleJobs.edit") {
    return "/ship-access/dry-dock/simple-jobs?status=draft";
  }
  if (page.key === "page.shipAccess.simpleJobs.masterReview") {
    return "/ship-access/dry-dock/simple-jobs?status=submitted";
  }
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
  const allowed = new Set(withMachineryRegisterPage(assignedPageKeys));
  return CREW_ASSIGNABLE_PAGES.filter((page) => allowed.has(page.key)).map(toNavItem);
}

/** Permission-filtered nav items grouped for dropdown menus. Empty groups omitted. */
export function buildShipAccessNavGroups(assignedPageKeys: string[]): ShipAccessNavGroup[] {
  const allowed = new Set(withMachineryRegisterPage(assignedPageKeys));
  const buckets = new Map<ShipAccessNavGroupId, ShipAccessNavItem[]>();

  for (const page of CREW_ASSIGNABLE_PAGES) {
    if (!allowed.has(page.key)) continue;
    const groupId = navGroupForPage(page);
    const list = buckets.get(groupId) ?? [];
    list.push(toNavItem(page));
    buckets.set(groupId, list);
  }

  return NAV_GROUP_ORDER.flatMap((id) => {
    const items = buckets.get(id);
    if (!items?.length) return [];
    const meta = NAV_GROUP_META[id];
    return [{ id, label: meta.label, icon: meta.icon, items }];
  });
}

export function buildCrewNavChildren(assignedPageKeys: string[]): TopNavChild[] {
  return buildShipAccessNavItems(assignedPageKeys).map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));
}

export function buildCrewTopNavItems(assignedPageKeys: string[]): TopNavItem[] {
  const groups = buildShipAccessNavGroups(assignedPageKeys);
  if (groups.length === 0) return [];

  return groups.map((group) => {
    const meta = NAV_GROUP_META[group.id];
    // Overview stays a top-level link; other groups become dropdown menus.
    if (group.id === "overview" && group.items.length === 1) {
      const only = group.items[0]!;
      return {
        id: meta.topNavId,
        label: only.label,
        href: only.href,
        description: only.description,
        icon: only.icon,
        tier: "priority" as const,
      };
    }
    return {
      id: meta.topNavId,
      label: group.label,
      href: group.items[0]?.href,
      description: group.label,
      icon: group.icon,
      tier: "priority" as const,
      children: group.items.map(({ href, label, icon }) => ({ href, label, icon })),
    };
  });
}

export function crewHasPageAccess(assignedPageKeys: string[], permissionKey: string): boolean {
  return assignedPageKeys.includes(permissionKey);
}

/** Pages shown when session is not vessel-crew (office/superintendent browsing Ship Access). */
export const SHIP_ACCESS_FULL_NAV_PAGE_KEYS = [
  "page.shipAccess.dashboard",
  "page.shipAccess.machineryDashboard",
  "page.shipAccess.machineryRegister",
  "page.shipAccess.machineryRunningHours",
  "page.shipAccess.machineryParameters",
  "page.shipAccess.machineryCondition",
  "page.shipAccess.dryDockDashboard",
  "page.shipAccess.simpleJobs",
  "page.shipAccess.simpleJobs.new",
  "page.shipAccess.dryDockJobs.new",
  "page.shipAccess.dryDockJobs",
  "page.shipAccess.defects.new",
  "page.shipAccess.defects",
  "page.shipAccess.purchase",
  "page.shipAccess.pms",
] as const;
