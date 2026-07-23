"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Archive,
  FileDown,
  MoreHorizontal,
  Pencil,
  Printer,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { notify } from "@/lib/notify";
import type { DdVesselJobDto } from "@/lib/superintendent/types";

type Props = {
  job: DdVesselJobDto;
  onChanged?: () => void;
};

export function ShipJobActionsMenu({ job, onChanged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const canEdit = job.status !== "integrated" && job.status !== "rejected" && !job.archivedAt;
  const editHref = `/ship-access/jobs/${job.id}/edit`;
  const printHref = `/ship-access/jobs/${job.id}/print`;

  const runAction = useCallback(
    async (action: "archive" | "assign_export" | "reopen_update") => {
      setBusy(true);
      try {
        const res = await fetch(`/api/ship-access/jobs/${job.id}/actions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = (await res.json()) as {
          error?: string;
          message?: string;
          vesselJob?: DdVesselJobDto;
        };
        if (!res.ok) {
          notify.error(data.error ?? "Action failed");
          return null;
        }
        notify.success(data.message ?? "Done");
        onChanged?.();
        return data.vesselJob ?? null;
      } finally {
        setBusy(false);
      }
    },
    [job.id, onChanged],
  );

  const handleUpdate = useCallback(async () => {
    if (!canEdit) {
      notify.warning("This job can no longer be updated onboard");
      return;
    }
    if (job.status === "draft") {
      router.push(editHref);
      return;
    }
    const updated = await runAction("reopen_update");
    if (updated) router.push(editHref);
  }, [canEdit, editHref, job.status, router, runAction]);

  const handleAssignExport = useCallback(async () => {
    await runAction("assign_export");
  }, [runAction]);

  const handleArchive = useCallback(async () => {
    const archived = await runAction("archive");
    if (archived) setArchiveOpen(false);
  }, [runAction]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={busy}
              aria-label="Actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem
            disabled={!canEdit}
            render={<Link href={editHref} />}
          >
            <Pencil className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canEdit || busy} onClick={() => void handleUpdate()}>
            <RefreshCw className="size-3.5" />
            Update
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={busy || Boolean(job.archivedAt)}
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="size-3.5" />
            Make Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy || Boolean(job.archivedAt)}
            onClick={() => void handleAssignExport()}
          >
            <FileDown className="size-3.5" />
            Assign job for export
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(job.archivedAt)}
            render={<Link href={printHref} target="_blank" />}
          >
            <Printer className="size-3.5" />
            Print
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this job?</AlertDialogTitle>
            <AlertDialogDescription>
              “{job.title}” will be removed from My job submissions. You can still find it in
              archived records later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void handleArchive()}>
              Make Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
