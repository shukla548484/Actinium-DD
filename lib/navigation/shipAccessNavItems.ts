import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Compass,
  Eye,
  Pencil,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";

export interface ShipAccessNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const shipAccessNavItems: ShipAccessNavItem[] = [
  {
    href: "/ship-access",
    label: "Overview",
    description: "Your vessel and active dry dock project",
    icon: Compass,
  },
  {
    href: "/ship-access/machinery-hours",
    label: "Machinery hours",
    description: "Update main engine, auxiliary, and boiler running hours",
    icon: Clock,
  },
  {
    href: "/ship-access/defects/new",
    label: "Report defect",
    description: "Report machinery and equipment defects",
    icon: PlusCircle,
  },
  {
    href: "/ship-access/defects?status=draft",
    label: "Update defects",
    description: "Edit draft defects before submission",
    icon: Pencil,
  },
  {
    href: "/ship-access/defects",
    label: "View defects",
    description: "Track defect submissions and Master approval",
    icon: Eye,
  },
  {
    href: "/ship-access/defects?status=submitted",
    label: "Master review",
    description: "Approve or reject submitted defects",
    icon: ShieldCheck,
  },
  {
    href: "/ship-access/jobs/new",
    label: "Create dry dock job",
    description: "Propose scope jobs for superintendent review",
    icon: PlusCircle,
  },
  {
    href: "/ship-access/jobs?status=draft",
    label: "Update jobs",
    description: "Edit draft jobs before submission",
    icon: Pencil,
  },
  {
    href: "/ship-access/jobs",
    label: "View jobs",
    description: "Track all vessel job bank submissions",
    icon: Eye,
  },
  {
    href: "/ship-access/purchase/new",
    label: "Create requisition",
    description: "Raise spares requisitions from approved defects",
    icon: PlusCircle,
  },
  {
    href: "/ship-access/purchase?status=draft",
    label: "Update requisitions",
    description: "Edit draft requisitions before submission",
    icon: Pencil,
  },
  {
    href: "/ship-access/purchase",
    label: "View requisitions",
    description: "Track spares requisitions and Master approval",
    icon: Eye,
  },
  {
    href: "/ship-access/purchase?status=submitted",
    label: "Master requisition review",
    description: "Approve or reject submitted requisitions",
    icon: ShieldCheck,
  },
];

/** @deprecated Use shipAccessNavItems — kept for spread compatibility. */
export const shipAccessNavChildren = shipAccessNavItems;
