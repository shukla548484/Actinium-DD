import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Package,
  Wrench,
} from "lucide-react";

export type VesselWorkspaceSegment =
  | "overview"
  | "condition"
  | "machinery"
  | "defects"
  | "jobs"
  | "requisitions";

export type VesselWorkspaceNavItem = {
  segment: VesselWorkspaceSegment;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Ship Access route for crew portal (when applicable). */
  shipAccessHref?: string;
};

export const VESSEL_WORKSPACE_NAV: VesselWorkspaceNavItem[] = [
  {
    segment: "overview",
    label: "Overview",
    description: "Vessel readiness summary and quick links for this dry dock project.",
    icon: LayoutDashboard,
  },
  {
    segment: "condition",
    label: "Condition reports",
    description: "Pre-docking hull, tank, machinery, and safety condition inputs.",
    icon: ClipboardList,
  },
  {
    segment: "machinery",
    label: "Machinery hours",
    description: "Main engine, auxiliary, and boiler running hours from the vessel.",
    icon: Clock,
    shipAccessHref: "/ship-access/machinery",
  },
  {
    segment: "defects",
    label: "Defects",
    description: "Open defects and equipment abnormalities reported by ship staff.",
    icon: AlertTriangle,
    shipAccessHref: "/ship-access/defects",
  },
  {
    segment: "jobs",
    label: "Dry dock jobs",
    description: "Ship-proposed scope jobs for superintendent review and integration.",
    icon: Wrench,
    shipAccessHref: "/ship-access/dry-dock/jobs",
  },
  {
    segment: "requisitions",
    label: "Requisitions",
    description: "Master-approved spares requisitions linked to approved defects.",
    icon: Package,
    shipAccessHref: "/ship-access/purchase",
  },
];

export function vesselWorkspaceHref(
  dryDockProjectId: string,
  segment: VesselWorkspaceSegment,
  portal = false,
): string {
  const base = portal
    ? `/superintendent/projects/${dryDockProjectId}/inputs/vessel-portal`
    : `/superintendent/projects/${dryDockProjectId}/inputs/vessel`;
  if (segment === "overview") return base;
  return `${base}/${segment}`;
}
