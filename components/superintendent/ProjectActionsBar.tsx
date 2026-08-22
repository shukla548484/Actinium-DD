"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DryDockProjectStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DD_STATUS_LIFECYCLE,
  getAllowedTransitions,
  getStatusLabel,
} from "@/lib/superintendent/engine/statusWorkflow";

type Props = {
  projectId: string;
  projectName: string;
  status: string;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
};

export function ProjectActionsBar({
  projectId,
  projectName,
  status,
  archivedAt = null,
  archivedByUserId = null,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const current = status as DryDockProjectStatus;
  const isArchived = Boolean(archivedAt) || current === "archived";
  const canUnarchive =
    isArchived &&
    (canDelete ||
      (userId != null && archivedByUserId != null && archivedByUserId === userId));

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const role = data?.user?.roleCode ?? "";
        const unrestricted = Boolean(data?.user?.moduleAccessUnrestricted);
        setUserId(data?.user?.userId ?? null);
        setCanDelete(
          unrestricted || role === "SYS_ADMIN" || role === "COMP_ADMIN",
        );
      })
      .catch(() => {
        setCanDelete(false);
        setUserId(null);
      });
  }, []);

  const { forward, side, legacy } = useMemo(
    () => getAllowedTransitions(current),
    [current],
  );

  const nextForward = useMemo(() => {
    const idx = DD_STATUS_LIFECYCLE.indexOf(current);
    if (idx === -1) return forward[0] ?? null;
    const ahead = forward.filter((s) => DD_STATUS_LIFECYCLE.indexOf(s) > idx);
    return (
      ahead.sort(
        (a, b) => DD_STATUS_LIFECYCLE.indexOf(a) - DD_STATUS_LIFECYCLE.indexOf(b),
      )[0] ?? null
    );
  }, [current, forward]);

  async function patchStatus(next: string) {
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = (await res.json()) as { error?: string };
    window.alert(data.error ?? "Status update failed");
  }

  async function duplicateProject() {
    const name = window.prompt("Name for duplicated project", `${projectName} (Copy)`);
    if (!name?.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${projectId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), copyScope: true }),
    });
    setBusy(false);
    if (!res.ok) return;
    const data = (await res.json()) as { project: { id: string } };
    router.push(`/superintendent/projects/${data.project.id}`);
    router.refresh();
  }

  async function archiveProject() {
    if (
      !window.confirm(
        "Archive this project? It will leave normal lists and move to your Archived section.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${projectId}/archive`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      window.alert(data.error ?? "Archive failed");
      return;
    }
    router.push("/projects/archived");
    router.refresh();
  }

  async function unarchiveProject() {
    if (!window.confirm("Unarchive this project and return it to active lists?")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${projectId}/archive`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      window.alert(data.error ?? "Unarchive failed");
      return;
    }
    router.push(`/superintendent/projects/${projectId}`);
    router.refresh();
  }

  async function deleteProject() {
    if (
      !window.confirm(
        "Permanently delete this project? This cannot be undone. Prefer Archive for most cases.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/superintendent/projects/${projectId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      window.alert(data.error ?? "Delete failed");
      return;
    }
    router.push("/superintendent/projects");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isArchived && nextForward ? (
        <Button size="sm" disabled={busy} onClick={() => void patchStatus(nextForward)}>
          Advance to {getStatusLabel(nextForward)}
        </Button>
      ) : null}
      {!isArchived ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void duplicateProject()}
        >
          Duplicate project
        </Button>
      ) : null}
      {!isArchived ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" disabled={busy}>
                Change status
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            {forward.length > 0 ? (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Lifecycle
                </div>
                {forward.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void patchStatus(s)}>
                    {getStatusLabel(s)}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {legacy.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Legacy
                </div>
                {legacy.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void patchStatus(s)}>
                    {getStatusLabel(s)}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {side.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Side states
                </div>
                {side.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => void patchStatus(s)}>
                    {getStatusLabel(s)}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`/superintendent/projects/${projectId}/edit`} />}
        nativeButton={false}
      >
        Edit details
      </Button>
      {!isArchived ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void archiveProject()}>
          Archive
        </Button>
      ) : (
        <>
          {canUnarchive ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void unarchiveProject()}
            >
              Unarchive
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/projects/archived" />}
            nativeButton={false}
          >
            View archived
          </Button>
        </>
      )}
      {canDelete ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => void deleteProject()}
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}
