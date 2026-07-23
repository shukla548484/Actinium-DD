"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { ProjectFilter } from "@/components/superintendent/ProjectFilter";
import { ChecklistCompletionRing } from "@/components/superintendent/ChecklistCompletionRing";
import {
  deleteResource,
  usePaginatedApi,
} from "@/components/superintendent/usePaginatedApi";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { fmtDate } from "@/lib/superintendent/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function newChecklistHref(projectId: string) {
  if (projectId && projectId !== "all") {
    return `/superintendent/planning/checklist/new?dryDockProjectId=${encodeURIComponent(projectId)}`;
  }
  return "/superintendent/planning/checklist/new";
}

type ChecklistRow = {
  id: string;
  dryDockProjectId: string;
  title: string;
  category: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  assignedTo: string | null;
  notes: string | null;
};

function checklistEditHref(row: ChecklistRow, filterProjectId: string) {
  const projectId =
    filterProjectId && filterProjectId !== "all"
      ? filterProjectId
      : row.dryDockProjectId;
  const qs = new URLSearchParams({ dryDockProjectId: projectId });
  return `/superintendent/planning/checklist/${row.id}/edit?${qs.toString()}`;
}

function PreDockChecklistInner() {
  const searchParams = useSearchParams();
  const scopedProjectId = searchParams.get("dryDockProjectId")?.trim();
  const [projectId, setProjectId] = useState(() => scopedProjectId || "all");
  const [preparing, setPreparing] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);

  const params: Record<string, string | undefined> = {
    dryDockProjectId: projectId,
  };
  const { items, loading, page, setPage, totalPages, total, completedCount, reload } =
    usePaginatedApi<ChecklistRow>("/api/superintendent/checklist", params);

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    const ok = await deleteResource(`/api/superintendent/checklist/${id}`);
    if (ok) void reload();
  }

  async function handlePrepare() {
    if (!projectId || projectId === "all") {
      setPrepareMessage("Select a dry dock project to prepare its checklist.");
      return;
    }
    setPreparing(true);
    setPrepareMessage(null);
    try {
      const res = await fetch("/api/superintendent/checklist/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryDockProjectId: projectId }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) {
        setPrepareMessage(data.error ?? "Prepare failed");
        return;
      }
      const added = data.added ?? 0;
      setPrepareMessage(
        added > 0
          ? `Added ${added} missing readiness item${added === 1 ? "" : "s"} from the project template.`
          : "Checklist already includes all template readiness items.",
      );
      void reload();
    } catch {
      setPrepareMessage("Network error while preparing checklist.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <ChecklistCompletionRing completed={completedCount} total={total} />
          <div className="flex flex-wrap items-center gap-2">
            <ProjectFilter
              value={projectId}
              onChange={(v) => {
                setPage(1);
                setProjectId(v);
                setPrepareMessage(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={preparing || projectId === "all"}
              onClick={() => void handlePrepare()}
              title={
                projectId === "all"
                  ? "Select a project to prepare its checklist"
                  : "Add any missing template pre-dock items"
              }
            >
              {preparing ? "Preparing…" : "Prepare checklist"}
            </Button>
            <Button
              size="sm"
              render={<Link href={newChecklistHref(projectId)} />}
              nativeButton={false}
            >
              Add
            </Button>
          </div>
        </CardContent>
        {prepareMessage ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{prepareMessage}</p>
        ) : null}
      </Card>

      <TableCard title="Checklist items">
        {loading ? (
          <ActiniumLoadingState size="md" minHeight={100} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {projectId === "all"
                      ? "No checklist items found. Select a project and use Prepare checklist."
                      : "No checklist items for this project. Use Prepare checklist to seed readiness tasks."}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => {
                  const href = checklistEditHref(row, projectId);
                  return (
                    <TableRow key={row.id} className="group">
                      <TableCell>
                        <Link
                          href={href}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                      </TableCell>
                      <TableCell>{row.category ?? "—"}</TableCell>
                      <TableCell>{row.isCompleted ? "Yes" : "No"}</TableCell>
                      <TableCell>{fmtDate(row.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={href} />}
                            nativeButton={false}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(row.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <PaginationBar page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

export function PreDockChecklistPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={100} />}>
      <PreDockChecklistInner />
    </Suspense>
  );
}
