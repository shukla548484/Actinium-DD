"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoBack } from "@/hooks/useGoBack";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { ProjectFilter } from "@/components/superintendent/ProjectFilter";
import {
  deleteResource,
  usePaginatedApi,
} from "@/components/superintendent/usePaginatedApi";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EntityColumn<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function EntityListPage<T extends { id: string }>(
  props: {
    title: string;
    description: string;
    apiPath: string;
    newHref: string;
    editHref: (id: string) => string;
    columns: EntityColumn<T>[];
    projectFilter?: boolean;
    searchPlaceholder?: string;
    searchParam?: string;
  },
) {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={100} />}>
      <EntityListPageInner {...props} />
    </Suspense>
  );
}

function EntityListPageInner<T extends { id: string }>({
  title,
  description,
  apiPath,
  newHref,
  editHref,
  columns,
  projectFilter = true,
  searchPlaceholder = "Search…",
  searchParam = "search",
}: {
  title: string;
  description: string;
  apiPath: string;
  newHref: string;
  editHref: (id: string) => string;
  columns: EntityColumn<T>[];
  projectFilter?: boolean;
  searchPlaceholder?: string;
  searchParam?: string;
}) {
  const searchParams = useSearchParams();
  const scopedProjectId = searchParams.get("dryDockProjectId")?.trim();
  const [projectId, setProjectId] = useState(() => scopedProjectId || "all");
  const [search, setSearch] = useState("");
  const params: Record<string, string | undefined> = {
    dryDockProjectId: projectFilter ? projectId : undefined,
    [searchParam]: search || undefined,
  };
  const { items, loading, page, setPage, totalPages, total, reload } =
    usePaginatedApi<T>(apiPath, params);

  async function handleDelete(id: string) {
    if (!confirm("Delete this record?")) return;
    const ok = await deleteResource(`${apiPath}/${id}`);
    if (ok) void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {projectFilter ? (
          <ProjectFilter value={projectId} onChange={(v) => { setPage(1); setProjectId(v); }} />
        ) : null}
        {searchParam ? (
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="max-w-xs"
          />
        ) : null}
      </div>

      <TableCard title={title}>
        {loading ? (
          <ActiniumLoadingState size="md" minHeight={100} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.header} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 1}
                    className="text-center text-muted-foreground"
                  >
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((c) => (
                      <TableCell key={c.header} className={c.className}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" render={<Link href={editHref(row.id)} />} nativeButton={false}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(row.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <PaginationBar page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </div>
  );
}

export function EntityFormActions({
  saving,
  onCancel,
  cancelFallbackHref,
}: {
  saving: boolean;
  onCancel?: () => void;
  /** Used when browser history is empty (defaults to parent path). */
  cancelFallbackHref?: string;
}) {
  const goBack = useGoBack(cancelFallbackHref);

  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel ?? goBack}>
        Cancel
      </Button>
    </div>
  );
}

export function useEntityFormSubmit(
  apiPath: string,
  mode: "create" | "edit",
  id: string | undefined,
  redirectTo: string,
) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const url = mode === "create" ? apiPath : `${apiPath}/${id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Save failed");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return { saving, error, submit };
}
