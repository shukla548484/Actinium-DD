"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EntityStatus } from "@prisma/client";

type EntityActionsProps = {
  entityType: "company" | "vessel" | "employee";
  id: string;
  status: EntityStatus;
  viewHref: string;
  editHref: string;
  assignVesselsHref?: string;
  assignModulesHref?: string;
  listRedirectPath?: string;
  onChanged?: () => void;
};

const API_BASE = {
  company: "/api/admin/companies",
  vessel: "/api/admin/vessels",
  employee: "/api/admin/employees",
};

export function EntityActionsMenu({
  entityType,
  id,
  status,
  viewHref,
  editHref,
  assignVesselsHref,
  assignModulesHref,
  listRedirectPath,
  onChanged,
}: EntityActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const setStatus = useCallback(
    async (next: EntityStatus) => {
      setBusy(true);
      try {
        await fetch(`${API_BASE[entityType]}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        onChanged?.();
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [entityType, id, onChanged, router],
  );

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE[entityType]}/${id}`, { method: "DELETE" });
      setDeleteOpen(false);
      onChanged?.();
      if (entityType === "company") router.push(listRedirectPath ?? "/admin/companies");
      else if (entityType === "vessel") router.push(listRedirectPath ?? "/admin/vessels");
      else router.push(listRedirectPath ?? "/admin/employees");
    } finally {
      setBusy(false);
    }
  }, [entityType, id, listRedirectPath, onChanged, router]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" disabled={busy} />}
        >
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={viewHref} />}>View</DropdownMenuItem>
          <DropdownMenuItem render={<Link href={editHref} />}>Edit</DropdownMenuItem>
          {assignVesselsHref ? (
            <DropdownMenuItem render={<Link href={assignVesselsHref} />}>
              Assign vessels
            </DropdownMenuItem>
          ) : null}
          {assignModulesHref ? (
            <DropdownMenuItem render={<Link href={assignModulesHref} />}>
              Assign Modules
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {status !== "active" ? (
            <DropdownMenuItem onClick={() => void setStatus("active")}>
              Set active
            </DropdownMenuItem>
          ) : null}
          {status !== "wait" ? (
            <DropdownMenuItem onClick={() => void setStatus("wait")}>
              Set waiting
            </DropdownMenuItem>
          ) : null}
          {status !== "inactive" ? (
            <DropdownMenuItem onClick={() => void setStatus("inactive")}>
              Deactivate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entityType}?</AlertDialogTitle>
            <AlertDialogDescription>
              This performs a soft delete. The record will no longer appear in lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
