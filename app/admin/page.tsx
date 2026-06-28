import Link from "next/link";
import { AdminOverviewCards } from "@/components/admin/RoleListPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function AdminOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        title="Administration"
        description="Manage companies, vessels, employees, roles, and page access for your organization."
        actions={
          <Button render={<Link href="/admin/companies/new" />} nativeButton={false}>
            Register company
          </Button>
        }
      />

      <AdminOverviewCards />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Companies</CardTitle>
            <CardDescription>
              Master and sub companies with active, waiting, and inactive status.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/companies" />}
              nativeButton={false}
            >
              Open companies →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vessels</CardTitle>
            <CardDescription>
              Register fleet units under each company and manage vessel status.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/vessels" />}
              nativeButton={false}
            >
              Open vessels →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employees</CardTitle>
            <CardDescription>
              Register staff, assign vessels, and activate access after assignment.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/employees" />}
              nativeButton={false}
            >
              Open employees →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>
              View the 33 system roles — office, vessel, and external users.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/roles" />}
              nativeButton={false}
            >
              Open roles →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Page access</CardTitle>
            <CardDescription>
              Decide which modules and pages each role can open.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/access" />}
              nativeButton={false}
            >
              Open matrix →
            </Button>
          </CardHeader>
        </Card>
      </div>
    </PageShell>
  );
}
