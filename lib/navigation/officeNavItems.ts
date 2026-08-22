import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  ClipboardCheck,
  Landmark,
  Ship,
  ShoppingBag,
  Users,
} from "lucide-react";

export type OfficeNavItem = {
  id: string;
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
};

export const officeNavItems: OfficeNavItem[] = [
  {
    id: "executive",
    href: "/office/executive",
    label: "Executive",
    description: "Approval inbox and KPIs",
    icon: Briefcase,
  },
  {
    id: "fleet",
    href: "/office/fleet",
    label: "Fleet",
    description: "Fleet performance dashboard",
    icon: Ship,
  },
  {
    id: "hseq",
    href: "/office/hseq",
    label: "HSEQ",
    description: "Incidents, audits, and ISM",
    icon: ClipboardCheck,
  },
  {
    id: "crewing",
    href: "/office/crewing",
    label: "Crewing",
    description: "Crew matrix and certifications",
    icon: Users,
  },
  {
    id: "procurement",
    href: "/office/procurement",
    label: "Procurement",
    description: "Procurement strategy and vendors",
    icon: ShoppingBag,
  },
  {
    id: "accounts",
    href: "/office/accounts",
    label: "Accounts",
    description: "Invoice verification and control",
    icon: Landmark,
  },
];
