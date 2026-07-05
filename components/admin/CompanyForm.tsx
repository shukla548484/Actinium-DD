import { OrganizationCompanyForm } from "@/components/admin/OrganizationCompanyForm";
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";
import type { CompanyDto } from "@/lib/admin/types";

type CompanyFormProps = {
  initial?: Partial<CompanyDto>;
  companyId?: string;
  mode: "create" | "edit";
};

export function CompanyForm(props: CompanyFormProps) {
  return <OrganizationCompanyForm module={ORGANIZATION_MODULES.companies} {...props} />;
}
