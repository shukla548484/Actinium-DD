"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { rbacUserTypeLabel } from "@/lib/rbac/userTypes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TableCard } from "@/components/layout/TableCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RoleRow = {
  id: string;
  roleNo: number | null;
  code: string;
  name: string;
  userType: string;
  hierarchyLevel: number;
  categoryTier: string | null;
  approvalLevel: number;
  reportsToCode: string | null;
  jobScope: string | null;
  department: string | null;
  permissionCount: number;
  userCount: number;
};

export function RoleListPanel() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((data) => setRoles(data.roles ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading roles…</p>;
  }

  return (
    <TableCard title="System roles" description="48-role designation catalog (Role ID 1001–6019)">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Role ID</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-14">Tier</TableHead>
            <TableHead className="w-14">Approval</TableHead>
            <TableHead>Reports to</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-mono text-muted-foreground">
                {role.roleNo ?? "—"}
              </TableCell>
              <TableCell>
                <div className="font-medium">{role.name}</div>
                {role.jobScope ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{role.jobScope}</p>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs">{role.code}</TableCell>
              <TableCell>
                <Badge variant="outline">{rbacUserTypeLabel(role.userType)}</Badge>
              </TableCell>
              <TableCell>{role.hierarchyLevel}</TableCell>
              <TableCell>{role.approvalLevel}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {role.reportsToCode ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{role.permissionCount}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  render={
                    <Link href={`/admin/access?role=${encodeURIComponent(role.id)}`} />
                  }
                  nativeButton={false}
                >
                  Edit access
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

export function AdminOverviewCards() {
  const [stats, setStats] = useState<{
    roleCount: number;
    permissionCount: number;
    pagePermissionCount: number;
    userCount: number;
    companyCount: number;
    shipyardCount: number;
    externalVendorCount: number;
    vesselCount: number;
    employeeCount: number;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null));
  }, []);

  const items = stats
    ? [
        { label: "Companies", value: stats.companyCount },
        { label: "Shipyards", value: stats.shipyardCount },
        { label: "External vendors", value: stats.externalVendorCount },
        { label: "Vessels", value: stats.vesselCount },
        { label: "Employees", value: stats.employeeCount },
        { label: "System roles", value: stats.roleCount },
        { label: "Users", value: stats.userCount },
      ]
    : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.label}>
            <CardHeader className="py-4">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}
