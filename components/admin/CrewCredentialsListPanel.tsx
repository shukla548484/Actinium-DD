"use client";

import Link from "next/link";
import type { EntityStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { CrewCredentialEditDialog } from "@/components/admin/CrewCredentialEditDialog";
import { EntityStatusBadge } from "@/components/admin/EntityStatusBadge";
import { TableCard } from "@/components/layout/TableCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrewCredentialsContextDto } from "@/lib/db/crewCredentials";

type CrewRow = {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  roleCode: string;
  loginId: string;
  vesselLoginId: string | null;
  status: string;
  isWatchKeeper: boolean;
};

type Props = {
  vesselId: string;
  context: CrewCredentialsContextDto;
  onChanged: () => void;
};

export function CrewCredentialsListPanel({ vesselId, context, onChanged }: Props) {
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrewRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const crewRows = useMemo((): CrewRow[] => {
    return context.roles.flatMap((role) =>
      role.assignments.map((assignment) => ({
        employeeId: assignment.employeeId,
        name: assignment.name,
        designation: role.designation,
        department: role.department,
        roleCode: role.roleCode,
        loginId: assignment.loginId,
        vesselLoginId: assignment.vesselLoginId,
        status: assignment.status,
        isWatchKeeper: assignment.isWatchKeeper,
      })),
    );
  }, [context.roles]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/admin/vessels/${vesselId}/crew-credentials/${deleteTarget.employeeId}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete crew credential");
        return;
      }
      setDeleteTarget(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TableCard
        title="Crew credentials on this vessel"
        description={`${crewRows.length} active credential${crewRows.length === 1 ? "" : "s"}`}
      >
        {crewRows.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1 py-2">
            No crew credentials yet. Create one above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Login IDs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crewRows.map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    <div>{row.designation}</div>
                    <div className="text-xs text-muted-foreground">{row.department}</div>
                    {row.isWatchKeeper ? (
                      <Badge variant="secondary" className="mt-1">
                        Watch keeper
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{row.loginId}</div>
                    {row.vesselLoginId ? (
                      <div className="text-muted-foreground">{row.vesselLoginId}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <EntityStatusBadge status={row.status as EntityStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        render={
                          <Link
                            href={`/admin/crew-credentials/${vesselId}/${row.employeeId}/pages`}
                          />
                        }
                        nativeButton={false}
                      >
                        Pages
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditEmployeeId(row.employeeId)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <CrewCredentialEditDialog
        vesselId={vesselId}
        employeeId={editEmployeeId}
        roleOptions={context.roles.map((role) => ({
          roleCode: role.roleCode,
          designation: role.designation,
          department: role.department,
        }))}
        open={editEmployeeId != null}
        onOpenChange={(open) => {
          if (!open) setEditEmployeeId(null);
        }}
        onSaved={onChanged}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete crew credential?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  This removes <strong>{deleteTarget.name}</strong> ({deleteTarget.designation})
                  from {context.vessel.name}. The login account will be disabled and the record
                  soft-deleted.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
