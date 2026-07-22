import Link from "next/link";
import { notFound } from "next/navigation";
import { EmployeePasswordPanel } from "@/components/admin/EmployeePasswordPanel";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEmployee } from "@/lib/db/employees";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <PageShell>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`${employee.employeeCode} · ${employee.company?.name ?? employee.companyName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href={`/admin/employees/${id}/assign-vessels`} />} nativeButton={false}>
              Assign vessels
            </Button>
            <Button render={<Link href={`/admin/employees/${id}/assign-modules`} />} nativeButton={false}>
              Assign Modules
            </Button>
            <Button render={<Link href={`/admin/employees/${id}/edit`} />} nativeButton={false}>
              Edit
            </Button>
            <EntityActionsMenu
              entityType="employee"
              id={id}
              status={employee.status}
              viewHref={`/admin/employees/${id}`}
              editHref={`/admin/employees/${id}/edit`}
              assignVesselsHref={`/admin/employees/${id}/assign-vessels`}
              assignModulesHref={`/admin/employees/${id}/assign-modules`}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <EntityStatusBadge status={employee.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Login ID</span>
              <span className="font-mono">{employee.loginId ?? employee.employeeCode}</span>
            </div>
            {employee.vesselLoginId ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vessel login ID</span>
                <span className="font-mono">{employee.vesselLoginId}</span>
              </div>
            ) : null}
            {employee.vesselLoginId ? (
              <p className="text-xs text-muted-foreground">
                Onboard crew sign in with the vessel login ID only.
              </p>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default password</span>
              <span>{DEFAULT_EMPLOYEE_PASSWORD}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{employee.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{employee.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Designation</span>
              <span>{employee.designation ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role ID</span>
              <span className="font-mono">
                {employee.role?.roleNo ?? employee.roleNo ?? "—"}
                {employee.role?.code ?? employee.roleCode ? (
                  <span className="ml-2 font-sans text-muted-foreground">
                    {employee.role?.code ?? employee.roleCode}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Approval level</span>
              <span className="font-mono">
                {(employee.role?.approvalLevel ?? employee.approvalLevel) != null
                  ? `A${employee.role?.approvalLevel ?? employee.approvalLevel}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Department</span>
              <span>{employee.department ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">System role</span>
              <span>{employee.role?.name ?? employee.roleName ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vessel access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{employee.vesselCount ?? 0}</p>
            <p className="text-sm text-muted-foreground">Assigned vessels</p>
            {employee.status === "wait" ? (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
                Waiting for vessel assignment — assign at least one vessel to activate.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <EmployeePasswordPanel
          employeeId={id}
          loginId={employee.loginId ?? employee.employeeCode}
          hasLogin={Boolean(employee.userId)}
        />
      </div>

      {employee.vesselAssignments && employee.vesselAssignments.length > 0 ? (
        <TableCard title="Assigned vessels">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Watch keeper</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.vesselAssignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.vesselCode}</TableCell>
                  <TableCell>
                    <Link href={`/admin/vessels/${a.vesselId}`} className="hover:underline">
                      {a.vesselName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EntityStatusBadge status={a.vesselStatus} />
                  </TableCell>
                  <TableCell>{a.isWatchKeeper ? "Yes" : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.assignedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : null}
    </PageShell>
  );
}
