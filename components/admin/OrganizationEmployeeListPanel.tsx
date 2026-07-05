"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RbacUserType } from "@prisma/client";
import type { EmployeeDto } from "@/lib/admin/types";

type Props = {
  companyId: string;
  title: string;
  description?: string;
  userTypeFilter?: RbacUserType;
};

export function OrganizationEmployeeListPanel({
  companyId,
  title,
  description,
  userTypeFilter,
}: Props) {
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      limit: "50",
      companyId,
      ...(userTypeFilter ? { userType: userTypeFilter } : {}),
    });
    const res = await fetch(`/api/admin/employees?${params}`);
    if (!res.ok) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { employees?: EmployeeDto[] };
    setEmployees(data.employees ?? []);
    setLoading(false);
  }, [companyId, userTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TableCard title={title} description={description}>
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading contacts…</p>
      ) : employees.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No contacts registered yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Login ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <Link href={`/admin/employees/${employee.id}`} className="font-medium hover:underline">
                    {employee.firstName} {employee.lastName}
                  </Link>
                </TableCell>
                <TableCell>{employee.designation ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{employee.loginId ?? employee.employeeCode}</TableCell>
                <TableCell>
                  <EntityStatusBadge status={employee.status} />
                </TableCell>
                <TableCell>
                  <EntityActionsMenu
                    entityType="employee"
                    id={employee.id}
                    status={employee.status}
                    viewHref={`/admin/employees/${employee.id}`}
                    editHref={`/admin/employees/${employee.id}/edit`}
                    assignVesselsHref={`/admin/employees/${employee.id}/assign-vessels`}
                    onChanged={() => void load()}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="border-t px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              href={`/admin/employees/new?companyId=${companyId}${userTypeFilter ? `&userType=${userTypeFilter}` : ""}`}
            />
          }
          nativeButton={false}
        >
          Register contact
        </Button>
      </div>
    </TableCard>
  );
}
