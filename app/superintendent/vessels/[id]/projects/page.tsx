"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  referenceCode: string | null;
};

type VesselSummary = { id: string; code: string; name: string };

export default function VesselProjectsPage() {
  const { id: vesselId } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [vessel, setVessel] = useState<VesselSummary | null>(null);

  const { items, loading, page, setPage, totalPages, total } = usePaginatedApi<ProjectRow>(
    "/api/superintendent/projects",
    { vesselId, search: search || undefined },
  );

  useEffect(() => {
    void fetch(`/api/superintendent/vessels/${vesselId}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.vessel as VesselSummary | undefined;
        if (v) setVessel({ id: v.id, code: v.code, name: v.name });
      });
  }, [vesselId]);

  const base = `/superintendent/vessels/${vesselId}/projects`;

  return (
    <PageShell>
      <PageHeader
        title="Vessel projects"
        description={
          vessel
            ? `${vessel.name} (${vessel.code}) — dry dock projects for this vessel.`
            : "Dry dock projects for this vessel."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href={`${base}/status`} />} nativeButton={false}>
              Update status
            </Button>
            <Button render={<Link href={`${base}/new`} />} nativeButton={false}>
              Create project
            </Button>
          </div>
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
                <TableHead>Project ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No projects for this vessel yet.{" "}
                    <Link href={`${base}/new`} className="text-primary hover:underline">
                      Create one
                    </Link>
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
                    <TableCell className="font-mono text-xs">{p.referenceCode ?? "—"}</TableCell>
                    <TableCell className="capitalize">{p.status.replace(/_/g, " ")}</TableCell>
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
