import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Eye,
  List,
  Pencil,
  PlusCircle,
  Ship,
} from "lucide-react";
import type { TopNavChild, TopNavItem } from "@/lib/navigation/topNavItems";

export const crewNavChildren: TopNavChild[] = [
  {
    href: "/ship-access/machinery-hours",
    label: "Machinery running hours",
    description: "Update main engine, auxiliary, and boiler running hours",
    icon: Clock,
  },
  {
    href: "/ship-access/jobs/new",
    label: "Create dry dock job",
    description: "Propose a new scope job for superintendent review",
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
    href: "/ship-access",
    label: "Vessel overview",
    description: "Your assigned vessel and active dry dock project",
    icon: List,
  },
];

/** Top navigation shown to onboard crew — vessel-scoped features only. */
export const crewTopNavItems: TopNavItem[] = [
  {
    id: "shipAccess",
    label: "Onboard",
    href: "/ship-access",
    description: "Machinery hours, dry dock jobs, and vessel overview",
    icon: Ship,
    tier: "priority",
    children: crewNavChildren,
  },
];

import type { TopNavId } from "@/lib/navigation/topNavItems";

export function resolveCrewActiveNavId(pathname: string): TopNavId {
  if (pathname.startsWith("/ship-access/machinery-hours")) return "shipAccess";
  if (pathname.startsWith("/ship-access/defects")) return "shipAccess";
  if (pathname.startsWith("/ship-access/purchase")) return "shipAccess";
  if (pathname.startsWith("/ship-access/jobs/new")) return "shipAccess";
  if (pathname.startsWith("/ship-access/jobs")) return "shipAccess";
  if (pathname.startsWith("/ship-access")) return "shipAccess";
  return "shipAccess";
}
