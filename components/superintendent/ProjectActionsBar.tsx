"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
};

export function ProjectActionsBar({ projectId, projectName, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = status as DryDockProjectStatus;

  const { forward, side, legacy } = useMemo(
    () => getAllowedTransitions(current),
    [current],
  );

  const nextForward = useMemo(() => {
    const idx = DD_STATUS_LIFECYCLE.indexOf(current);
    if (idx === -1) return forward[0] ?? null;
    const ahead = forward.filter((s) => DD_STATUS_LIFECYCLE.indexOf(s) > idx);
    return ahead.sort((a, b) => DD_STATUS_LIFECYCLE.indexOf(a) - DD_STATUS_LIFECYCLE.indexOf(b))[0] ?? null;
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextForward ? (
        <Button size="sm" disabled={busy} onClick={() => void patchStatus(nextForward)}>
          Advance to {getStatusLabel(nextForward)}
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void duplicateProject()}
      >
        Duplicate project
      </Button>
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
      <Button
        variant="outline"
        size="sm"
        render={<Link href={`/superintendent/projects/${projectId}/edit`} />}
        nativeButton={false}
      >
        Edit details
      </Button>
    </div>
  );
}
