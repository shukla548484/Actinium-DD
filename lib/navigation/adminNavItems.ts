export type AdminNavId =
  | "overview"
  | "masterCatalog"
  | "companies"
  | "vessels"
  | "employees"
  | "roles"
  | "access";

export interface AdminNavItem {
  id: AdminNavId;
  label: string;
  href: string;
  description: string;
  group: "Organization" | "Catalog" | "Access control";
}

/** Admin sub-navigation — shown in the module sidebar, not the top bar. */
export const adminNavItems: AdminNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/admin",
    description: "Admin module summary",
    group: "Organization",
  },
  {
    id: "companies",
    label: "Companies",
    href: "/admin/companies",
    description: "Master and sub company management",
    group: "Organization",
  },
  {
    id: "vessels",
    label: "Vessels",
    href: "/admin/vessels",
    description: "Fleet registration and status",
    group: "Organization",
  },
  {
    id: "employees",
    label: "Employees",
    href: "/admin/employees",
    description: "Staff registration and vessel assignment",
    group: "Organization",
  },
  {
    id: "masterCatalog",
    label: "Master catalog",
    href: "/admin/master-catalog",
    description: "Standard spec lines for docking and general services",
    group: "Catalog",
  },
  {
    id: "roles",
    label: "Roles",
    href: "/admin/roles",
    description: "System role catalog and hierarchy",
    group: "Access control",
  },
  {
    id: "access",
    label: "Page access",
    href: "/admin/access",
    description: "Which pages each role can open",
    group: "Access control",
  },
];

export const adminNavGroups = ["Organization", "Catalog", "Access control"] as const;

export function resolveAdminNavId(pathname: string): AdminNavId {
  if (pathname.startsWith("/admin/master-catalog")) return "masterCatalog";
  if (pathname.startsWith("/admin/companies")) return "companies";
  if (pathname.startsWith("/admin/vessels")) return "vessels";
  if (pathname.startsWith("/admin/employees")) return "employees";
  if (pathname.startsWith("/admin/roles")) return "roles";
  if (pathname.startsWith("/admin/access")) return "access";
  return "overview";
}
