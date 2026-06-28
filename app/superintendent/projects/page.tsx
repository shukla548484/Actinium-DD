"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { usePaginatedApi } from "@/components/superintendent/usePaginatedApi";
import { fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progressPct: number | null;
  budgetTotal: number | null;
  vessel: { id: string; name: string; code: string };
};

export default function SuperintendentProjectsPage() {
  const [search, setSearch] = useState("");
  const { items, loading, page, setPage, totalPages, total } = usePaginatedApi<ProjectRow>(
    "/api/superintendent/projects",
    { search: search || undefined },
  );

  return (
    <PageShell>
      <PageHeader
        title="Dry dock projects"
        description="Active and planned dry dock executions."
        actions={
          <Button render={<Link href="/superintendent/projects/new" />} nativeButton={false}>
            Add
          </Button>
        }
      />

      <Input
        placeholder="Search projects…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="max-w-xs"
      />

      <TableCard title="Projects">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/superintendent/projects/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell>{p.vessel.name}</TableCell>
                    <TableCell>{p.status.replace(/_/g, " ")}</TableCell>
                    <TableCell>{fmtPct(p.progressPct)}</TableCell>
                    <TableCell>{fmtMoney(p.budgetTotal)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/superintendent/projects/${p.id}/edit`} />}
                        nativeButton={false}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <PaginationBar page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </PageShell>
  );
}
