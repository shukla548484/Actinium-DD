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
import { ORGANIZATION_MODULES } from "@/lib/admin/organizationModules";

export const dynamic = "force-dynamic";

const organizationModules = [
  ORGANIZATION_MODULES.companies,
  ORGANIZATION_MODULES.shipyards,
  ORGANIZATION_MODULES.externalVendors,
  { ...ORGANIZATION_MODULES.companies, id: "vessels", label: "Vessels", labelSingular: "Vessel", basePath: "/admin/vessels", registerLabel: "Register vessel", description: "Fleet units under each company" },
  { ...ORGANIZATION_MODULES.companies, id: "employees", label: "Employees", labelSingular: "Employee", basePath: "/admin/employees", registerLabel: "Register employee", description: "Office staff, vessel assignment, and portal access" },
] as const;

export default function AdminOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        title="Administration"
        description="Register and manage companies, shipyards, external vendors, vessels, employees, roles, and page access."
        actions={
          <Button render={<Link href="/admin/companies/new" />} nativeButton={false}>
            Register company
          </Button>
        }
      />

      <AdminOverviewCards />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizationModules.map((module) => (
          <Card key={module.basePath}>
            <CardHeader>
              <CardTitle className="text-base">{module.label}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
              <Button
                variant="link"
                className="h-auto w-fit p-0"
                render={<Link href={module.basePath} />}
                nativeButton={false}
              >
                Open {module.label.toLowerCase()} →
              </Button>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crew credentials</CardTitle>
            <CardDescription>
              Onboard login IDs and page access assignments by vessel.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/admin/crew-credentials" />}
              nativeButton={false}
            >
              Open crew credentials →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>
              View the system role catalog — office, vessel, shipyard, and external users.
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
