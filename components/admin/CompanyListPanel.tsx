import { OrganizationCompanyListPanel } from "@/components/admin/OrganizationCompanyListPanel";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";
import type { CompanyCategory } from "@prisma/client";

export function CompanyListPanel({
  category,
}: {
  category?: CompanyCategory;
}) {
  const module =
    category === "shipyard"
      ? ORGANIZATION_MODULES.shipyards
      : category === "external_vendor"
        ? ORGANIZATION_MODULES.externalVendors
        : category
          ? { ...ORGANIZATION_MODULES.companies, category }
          : ORGANIZATION_MODULES.companies;

  return <OrganizationCompanyListPanel module={module} />;
}
