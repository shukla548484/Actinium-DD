import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompany } from "@/lib/db/companies";
import { companyCategoryLabel } from "@/lib/admin/companyCategory";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <PageShell>
      <PageHeader
        title={company.name}
        description={`Company code ${company.code}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href={`/admin/vessels/new?companyId=${id}`} />}
              nativeButton={false}
            >
              Register vessel
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/admin/employees/new?companyId=${id}`} />}
              nativeButton={false}
            >
              Register employee
            </Button>
            <Button render={<Link href={`/admin/companies/${id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
            <EntityActionsMenu
              entityType="company"
              id={id}
              status={company.status}
              viewHref={`/admin/companies/${id}`}
              editHref={`/admin/companies/${id}/edit`}
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
              <span className="text-muted-foreground">Company type</span>
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
      </div>
    </PageShell>
  );
}
