import { CompanyForm } from "@/components/admin/CompanyForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

export default function NewCompanyPage() {
  return (
    <PageShell>
      <PageHeader
        title="Register company"
        description="Create a new master or sub company. Code is generated automatically from the name."
      />
      <CompanyForm mode="create" />
    </PageShell>
  );
}
