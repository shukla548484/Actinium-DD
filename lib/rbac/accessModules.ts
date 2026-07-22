import type { RbacUserType } from "@prisma/client";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { CREW_ASSIGNABLE_PAGES } from "@/lib/shipAccess/crewPages";
import type { TopNavId } from "@/lib/navigation/topNavItems";

/** Product modules that can be assigned to an employee, then pages within each module. */
export type AccessModuleCode =
  | "admin"
  | "jobs"
  | "purchase"
  | "company"
  | "superintendent"
  | "shipyard"
  | "shipAccess"
  | "external"
  | "platform"
  | "office";

export type AccessModulePage = {
  key: string;
  label: string;
  description?: string;
  route?: string;
};

export type AccessModuleDefinition = {
  code: AccessModuleCode;
  label: string;
  description: string;
  /** Top-nav id when this module appears in the portal chrome. */
  navId?: TopNavId;
  /** User types that may be assigned this module. */
  userTypes: RbacUserType[];
  pages: AccessModulePage[];
};

function pagesFromPermissionPrefix(
  prefix: string,
  extra?: AccessModulePage[],
): AccessModulePage[] {
  const fromCatalog: AccessModulePage[] = PERMISSIONS.filter(
    (p) => p.key.startsWith(prefix) && p.key.startsWith("page."),
  ).map((p) => ({
    key: p.key,
    label: p.description ?? p.key,
    description: p.description,
    route: p.resource ?? undefined,
  }));
  const keys = new Set(fromCatalog.map((p) => p.key));
  const merged = [...fromCatalog];
  for (const page of extra ?? []) {
    if (!keys.has(page.key)) merged.push(page);
  }
  return merged.sort((a, b) => a.label.localeCompare(b.label));
}

const CREW_PAGES: AccessModulePage[] = CREW_ASSIGNABLE_PAGES.map((p) => ({
  key: p.key,
  label: p.label,
  description: p.description,
  route: p.route,
}));

/** Canonical assignable modules → pages catalog. */
export const ACCESS_MODULES: AccessModuleDefinition[] = [
  {
    code: "admin",
    label: "Admin",
    description: "Organization, catalogs, and access control",
    navId: "admin",
    userTypes: ["system", "office"],
    pages: pagesFromPermissionPrefix("page.office.admin"),
  },
  {
    code: "company",
    label: "Company",
    description: "Companies, vessels, and employee management",
    navId: "company",
    userTypes: ["system", "office"],
    pages: pagesFromPermissionPrefix("page.office.admin").filter((p) =>
      [
        "page.office.admin.companies",
        "page.office.admin.vessels",
        "page.office.admin.employees",
      ].includes(p.key),
    ),
  },
  {
    code: "jobs",
    label: "Job Creations",
    description: "Dry-dock tender projects and specifications",
    navId: "jobs",
    userTypes: ["system", "office"],
    pages: pagesFromPermissionPrefix("page.office.project").concat(
      pagesFromPermissionPrefix("page.office.projects"),
    ),
  },
  {
    code: "purchase",
    label: "Purchase",
    description: "Requisitions, POs, invoices, and vendors",
    navId: "purchase",
    userTypes: ["system", "office"],
    pages: pagesFromPermissionPrefix("page.purchase"),
  },
  {
    code: "superintendent",
    label: "Tech Superintendent",
    description: "Dry dock planning, jobs, budget, and monitoring",
    navId: "superintendent",
    userTypes: ["system", "office"],
    pages: pagesFromPermissionPrefix("page.superintendent"),
  },
  {
    code: "office",
    label: "Office departments",
    description: "Executive, fleet, HSEQ, crewing, accounts",
    userTypes: ["system", "office"],
    pages: [
      ...pagesFromPermissionPrefix("page.office.department"),
      ...pagesFromPermissionPrefix("page.office.procurement"),
      ...pagesFromPermissionPrefix("page.office.accounts"),
    ],
  },
  {
    code: "shipyard",
    label: "Shipyard",
    description: "Workshop execution, planning, and commercial",
    navId: "shipyard",
    userTypes: ["system", "office", "shipyard"],
    pages: pagesFromPermissionPrefix("page.shipyard").concat(
      pagesFromPermissionPrefix("page.yard"),
    ),
  },
  {
    code: "shipAccess",
    label: "Ship Access",
    description: "Onboard crew portal — machinery, defects, dry dock, purchase",
    navId: "shipAccess",
    userTypes: ["system", "office", "vessel"],
    pages: CREW_PAGES,
  },
  {
    code: "external",
    label: "External",
    description: "Vendor and external party portals",
    userTypes: ["system", "office", "external"],
    pages: pagesFromPermissionPrefix("page.external"),
  },
  {
    code: "platform",
    label: "Platform",
    description: "Developer admin, monitoring, and operators",
    userTypes: ["system"],
    pages: pagesFromPermissionPrefix("page.platform"),
  },
];

const MODULE_BY_CODE = new Map(ACCESS_MODULES.map((m) => [m.code, m]));

export function getAccessModule(code: string): AccessModuleDefinition | undefined {
  return MODULE_BY_CODE.get(code as AccessModuleCode);
}

export function listAccessModulesForUserType(
  userType: RbacUserType,
): AccessModuleDefinition[] {
  return ACCESS_MODULES.filter((m) => m.userTypes.includes(userType));
}

export function allAssignablePageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const mod of ACCESS_MODULES) {
    for (const page of mod.pages) keys.add(page.key);
  }
  return keys;
}

export function pageKeysForModules(moduleCodes: string[]): Set<string> {
  const keys = new Set<string>();
  for (const code of moduleCodes) {
    const mod = getAccessModule(code);
    if (!mod) continue;
    for (const page of mod.pages) keys.add(page.key);
  }
  return keys;
}

export function moduleCodeForPageKey(pageKey: string): AccessModuleCode | null {
  for (const mod of ACCESS_MODULES) {
    if (mod.pages.some((p) => p.key === pageKey)) return mod.code;
  }
  // Prefix fallback for pages not listed under company subset of admin
  if (pageKey.startsWith("page.office.admin")) return "admin";
  if (pageKey.startsWith("page.office.project")) return "jobs";
  if (pageKey.startsWith("page.purchase")) return "purchase";
  if (pageKey.startsWith("page.superintendent")) return "superintendent";
  if (pageKey.startsWith("page.shipyard") || pageKey.startsWith("page.yard")) return "shipyard";
  if (pageKey.startsWith("page.shipAccess")) return "shipAccess";
  if (pageKey.startsWith("page.external")) return "external";
  if (pageKey.startsWith("page.platform")) return "platform";
  if (pageKey.startsWith("page.office")) return "office";
  return null;
}

export function isValidModuleCode(code: string): code is AccessModuleCode {
  return MODULE_BY_CODE.has(code as AccessModuleCode);
}

export function isValidPageKeyForModule(moduleCode: string, pageKey: string): boolean {
  const mod = getAccessModule(moduleCode);
  if (!mod) return false;
  return mod.pages.some((p) => p.key === pageKey);
}
