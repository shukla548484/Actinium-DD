"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type VesselRow = {
  id: string;
  code: string;
  name: string;
  companyName: string;
  companyCode: string;
  assigned: boolean;
};

type AssignData = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    loginId?: string;
    vesselLoginId?: string | null;
    status: string;
    companyName?: string;
  };
  availableVessels: VesselRow[];
};

export function AssignVesselsPanel({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AssignData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [watchKeepers, setWatchKeepers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/employees/${employeeId}/assign-vessels`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load");
      setLoading(false);
      return;
    }
    setData(json);
    const assigned = new Set<string>(
      (json.availableVessels as VesselRow[]).filter((v) => v.assigned).map((v) => v.id),
    );
    setSelected(assigned);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleVessel(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else {
        next.delete(id);
        setWatchKeepers((wk) => {
          const n = new Set(wk);
          n.delete(id);
          return n;
        });
      }
      return next;
    });
  }

  async function handleSave() {
    if (selected.size === 0) {
      setError("Select at least one vessel");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/employees/${employeeId}/assign-vessels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vesselIds: [...selected],
        watchKeeperVesselIds: [...watchKeepers],
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to assign vessels");
      return;
    }
    router.push(`/admin/employees/${employeeId}`);
    router.refresh();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading vessels…</p>;
  if (!data) return <p className="text-sm text-destructive">{error ?? "Employee not found"}</p>;

  const { employee, availableVessels } = data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {employee.firstName} {employee.lastName}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span>{employee.employeeCode} · {employee.companyName}</span>
            <EntityStatusBadge status={employee.status as "active" | "wait" | "inactive"} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Select vessels from the employee&apos;s master company and sub-companies. Saving
            assignments sets the employee to Active.
          </p>
          <p className="text-sm">
            Login ID:{" "}
            <strong className="font-mono">{employee.loginId ?? employee.employeeCode}</strong>
            {employee.vesselLoginId ? (
              <>
                {" "}
                · Vessel login ID:{" "}
                <strong className="font-mono">{employee.vesselLoginId}</strong>
              </>
            ) : null}{" "}
            · Default password: <strong>{DEFAULT_EMPLOYEE_PASSWORD}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available vessels</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Assign</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-32">Watch keeper</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableVessels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No active vessels in this company hierarchy
                  </TableCell>
                </TableRow>
              ) : (
                availableVessels.map((v) => {
                  const isSelected = selected.has(v.id);
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => toggleVessel(v.id, c === true)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{v.code}</TableCell>
                      <TableCell>{v.name}</TableCell>
                      <TableCell className="text-sm">
                        {v.companyName} ({v.companyCode})
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          disabled={!isSelected}
                          checked={watchKeepers.has(v.id)}
                          onCheckedChange={(c) => {
                            setWatchKeepers((prev) => {
                              const next = new Set(prev);
                              if (c === true) next.add(v.id);
                              else next.delete(v.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={busy || selected.size === 0}>
          {busy ? "Saving…" : "Save vessel assignments"}
        </Button>
        <Button variant="outline" render={<Link href={`/admin/employees/${employeeId}`} />} nativeButton={false}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
