import type { CompanyCategory } from "@prisma/client";

export type OrganizationModuleId = "companies" | "shipyards" | "externalVendors";

export type OrganizationModule = {
  id: OrganizationModuleId;
  label: string;
  labelSingular: string;
  description: string;
  basePath: string;
  category?: CompanyCategory;
  excludeCategories?: CompanyCategory[];
  registerLabel: string;
  showFleetSummary: boolean;
  showRegisterVessel: boolean;
  showRegisterEmployee: boolean;
  employeeUserType?: "external" | "shipyard" | "office";
};

/** Admin organization modules — each maps to Company records with a category filter. */
export const ORGANIZATION_MODULES: Record<OrganizationModuleId, OrganizationModule> = {
  companies: {
    id: "companies",
    label: "Companies",
    labelSingular: "Company",
    description: "Ship owners and ship management companies",
    basePath: "/admin/companies",
    excludeCategories: ["shipyard", "external_vendor"],
    registerLabel: "Register company",
    showFleetSummary: true,
    showRegisterVessel: true,
    showRegisterEmployee: true,
  },
  shipyards: {
    id: "shipyards",
    label: "Shipyards",
    labelSingular: "Shipyard",
    description: "Dry dock and repair yard organizations",
    basePath: "/admin/shipyards",
    category: "shipyard",
    registerLabel: "Register shipyard",
    showFleetSummary: false,
    showRegisterVessel: false,
    showRegisterEmployee: true,
    employeeUserType: "shipyard",
  },
  externalVendors: {
    id: "externalVendors",
    label: "External vendors",
    labelSingular: "External vendor",
    description: "Makers, suppliers, class societies, and other external parties",
    basePath: "/admin/external-vendors",
    category: "external_vendor",
    registerLabel: "Register vendor",
    showFleetSummary: false,
    showRegisterVessel: false,
    showRegisterEmployee: true,
    employeeUserType: "external",
  },
};

export function getOrganizationModule(id: OrganizationModuleId): OrganizationModule {
  return ORGANIZATION_MODULES[id];
}

export function organizationModuleForCategory(
  category: CompanyCategory,
): OrganizationModule | null {
  if (category === "shipyard") return ORGANIZATION_MODULES.shipyards;
  if (category === "external_vendor") return ORGANIZATION_MODULES.externalVendors;
  if (category === "ship_management" || category === "ship_owner" || category === "other") {
    return ORGANIZATION_MODULES.companies;
  }
  return null;
}

export function organizationModuleForPath(pathname: string): OrganizationModuleId | null {
  if (pathname.startsWith("/admin/shipyards")) return "shipyards";
  if (pathname.startsWith("/admin/external-vendors")) return "externalVendors";
  if (pathname.startsWith("/admin/companies")) return "companies";
  return null;
}
