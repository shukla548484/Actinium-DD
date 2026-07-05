import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  FolderTree,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Layers,
  Shield,
  Ship,
  Users,
  Warehouse,
} from "lucide-react";

export type AdminNavId =
  | "overview"
  | "masterCatalog"
  | "jobLibrary"
  | "jobCatalog"
  | "companies"
  | "shipyards"
  | "externalVendors"
  | "vessels"
  | "employees"
  | "crewCredentials"
  | "roles"
  | "access";

export interface AdminNavItem {
  id: AdminNavId;
  label: string;
  href: string;
  description: string;
  group: "Organization" | "Catalog" | "Access control";
  icon: LucideIcon;
}

/** Admin sub-navigation — shown in the module sidebar, not the top bar. */
export const adminNavItems: AdminNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/admin",
    description: "Admin module summary",
    group: "Organization",
    icon: LayoutDashboard,
  },
  {
    id: "companies",
    label: "Companies",
    href: "/admin/companies",
    description: "Ship owners and ship management companies",
    group: "Organization",
    icon: Building2,
  },
  {
    id: "shipyards",
    label: "Shipyards",
    href: "/admin/shipyards",
    description: "Dry dock and repair yard registration",
    group: "Organization",
    icon: Warehouse,
  },
  {
    id: "externalVendors",
    label: "External vendors",
    href: "/admin/external-vendors",
    description: "Makers, suppliers, class, and external parties",
    group: "Organization",
    icon: Handshake,
  },
  {
    id: "vessels",
    label: "Vessels",
    href: "/admin/vessels",
    description: "Fleet registration and status",
    group: "Organization",
    icon: Ship,
  },
  {
    id: "employees",
    label: "Employees",
    href: "/admin/employees",
    description: "Office staff registration and vessel assignment",
    group: "Organization",
    icon: Users,
  },
  {
    id: "crewCredentials",
    label: "Crew credentials",
    href: "/admin/crew-credentials",
    description: "Onboard login credentials and page access by vessel",
    group: "Organization",
    icon: BadgeCheck,
  },
  {
    id: "jobCatalog",
    label: "Job catalog DB",
    href: "/admin/job-catalog",
    description: "Spreadsheet schema tables for dynamic job templates (tabs 01–09)",
    group: "Catalog",
    icon: Layers,
  },
  {
    id: "jobLibrary",
    label: "Job library",
    href: "/admin/job-library",
    description: "Dry dock scope master job hierarchy for vessel technical engine",
    group: "Catalog",
    icon: FolderTree,
  },
  {
    id: "masterCatalog",
    label: "Master catalog",
    href: "/admin/master-catalog",
    description: "Standard spec lines for docking and general services",
    group: "Catalog",
    icon: BookOpen,
  },
  {
    id: "roles",
    label: "Roles",
    href: "/admin/roles",
    description: "System role catalog and hierarchy",
    group: "Access control",
    icon: Shield,
  },
  {
    id: "access",
    label: "Page access",
    href: "/admin/access",
    description: "Which pages each role can open",
    group: "Access control",
    icon: KeyRound,
  },
];

export const adminNavGroups = ["Organization", "Catalog", "Access control"] as const;

export function resolveAdminNavId(pathname: string): AdminNavId {
  if (pathname.startsWith("/admin/job-catalog")) return "jobCatalog";
  if (pathname.startsWith("/admin/job-library")) return "jobLibrary";
  if (pathname.startsWith("/admin/master-catalog")) return "masterCatalog";
  if (pathname.startsWith("/admin/companies")) return "companies";
  if (pathname.startsWith("/admin/shipyards")) return "shipyards";
  if (pathname.startsWith("/admin/external-vendors")) return "externalVendors";
  if (pathname.startsWith("/admin/vessels")) return "vessels";
  if (pathname.startsWith("/admin/employees")) return "employees";
  if (pathname.startsWith("/admin/crew-credentials")) return "crewCredentials";
  if (pathname.startsWith("/admin/roles")) return "roles";
  if (pathname.startsWith("/admin/access")) return "access";
  return "overview";
}
