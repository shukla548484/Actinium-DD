"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  department: string | null;
  permissionCount: number;
  userCount: number;
};

const USER_TYPE_LABEL: Record<string, string> = {
  system: "System",
  office: "Office",
  vessel: "Vessel",
  external: "External",
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
    <TableCard title="System roles" description="33-role catalog from your RBAC spreadsheet">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">No.</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-16">Level</TableHead>
            <TableHead>Department</TableHead>
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
              <TableCell className="font-medium">{role.name}</TableCell>
              <TableCell className="font-mono text-xs">{role.code}</TableCell>
              <TableCell>
                <Badge variant="outline">{USER_TYPE_LABEL[role.userType] ?? role.userType}</Badge>
              </TableCell>
              <TableCell>{role.hierarchyLevel}</TableCell>
              <TableCell className="text-muted-foreground">{role.department ?? "—"}</TableCell>
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
        { label: "Vessels", value: stats.vesselCount },
        { label: "Employees", value: stats.employeeCount },
        { label: "System roles", value: stats.roleCount },
        { label: "Page permissions", value: stats.pagePermissionCount },
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
