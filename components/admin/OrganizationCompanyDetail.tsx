import Link from "next/link";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { OrganizationEmployeeListPanel } from "@/components/admin/OrganizationEmployeeListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { companyCategoryLabel } from "@/lib/admin/companyCategory";
import type { OrganizationModule } from "@/lib/admin/organizationModules";
import type { CompanyDto } from "@/lib/admin/types";

type Props = {
  module: OrganizationModule;
  company: CompanyDto;
};

export function OrganizationCompanyDetail({ module, company }: Props) {
  const id = company.id;

  return (
    <PageShell>
      <PageHeader
        title={company.name}
        description={`${module.labelSingular} code ${company.code}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {module.showRegisterVessel ? (
              <Button
                variant="outline"
                render={<Link href={`/admin/vessels/new?companyId=${id}`} />}
                nativeButton={false}
              >
                Register vessel
              </Button>
            ) : null}
            {module.showRegisterEmployee ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/admin/employees/new?companyId=${id}${module.employeeUserType ? `&userType=${module.employeeUserType}` : ""}`}
                  />
                }
                nativeButton={false}
              >
                Register contact
              </Button>
            ) : null}
            <Button render={<Link href={`${module.basePath}/${id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
            <EntityActionsMenu
              entityType="company"
              id={id}
              status={company.status}
              viewHref={`${module.basePath}/${id}`}
              editHref={`${module.basePath}/${id}/edit`}
              listRedirectPath={module.basePath}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <EntityStatusBadge status={company.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization type</span>
              <span>{companyCategoryLabel(company.category)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organization level</span>
              <span>{company.type === "MASTER" ? "Master" : "Sub"}</span>
            </div>
            {company.parentName ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parent</span>
                <span>{company.parentName}</span>
              </div>
            ) : null}
            {company.address ? (
              <div>
                <span className="text-muted-foreground">Address</span>
                <p className="mt-1">{company.address}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Person</span>
              <span>{company.contactPerson ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span>{company.contactEmail ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Phone</span>
              <span>{company.contactPhone ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        {module.showFleetSummary ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Fleet summary</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/admin/vessels/new?companyId=${id}`} />}
                  nativeButton={false}
                >
                  Register vessel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/admin/employees/new?companyId=${id}`} />}
                  nativeButton={false}
                >
                  Register employee
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold">{company.vesselCount ?? 0}</p>
                <p className="text-muted-foreground">Vessels</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{company.employeeCount ?? 0}</p>
                <p className="text-muted-foreground">Employees</p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {module.showRegisterEmployee ? (
        <OrganizationEmployeeListPanel
          companyId={id}
          title={`${module.labelSingular} contacts`}
          description="Registered users linked to this organization"
          userTypeFilter={module.employeeUserType}
        />
      ) : null}
    </PageShell>
  );
}
