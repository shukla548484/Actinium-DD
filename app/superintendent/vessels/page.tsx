"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { VesselProjectActionsMenu } from "@/components/superintendent/VesselProjectActionsMenu";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { usePaginatedApi } from "@/components/superintendent/usePaginatedApi";
import { fmtDate } from "@/lib/superintendent/formatters";
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

export const dynamic = "force-dynamic";

type VesselRow = {
  id: string;
  code: string;
  name: string;
  imoNumber: string | null;
  readinessScore: number | null;
  nextDryDockDue: string | null;
};

export default function SuperintendentVesselsPage() {
  const [search, setSearch] = useState("");
  const { items, loading, page, setPage, totalPages, total } = usePaginatedApi<VesselRow>(
    "/api/superintendent/vessels",
    { search: search || undefined },
  );

  return (
    <PageShell>
      <PageHeader
        title="Assigned vessels"
        description="Vessels in your scope with readiness scores and dry-dock dates."
      />

      <Input
        placeholder="Search by name, code, or IMO…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="max-w-xs"
      />

      <TableCard title="Vessels">
        {loading ? (
          <ActiniumLoadingState size="md" minHeight={100} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>IMO</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Next DD due</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No vessels found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link
                        href={`/superintendent/vessels/${v.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {v.code}
                      </Link>
                    </TableCell>
                    <TableCell>{v.name}</TableCell>
                    <TableCell>{v.imoNumber ?? "—"}</TableCell>
                    <TableCell>{v.readinessScore != null ? `${v.readinessScore}%` : "—"}</TableCell>
                    <TableCell>{fmtDate(v.nextDryDockDue)}</TableCell>
                    <TableCell className="text-right">
                      <VesselProjectActionsMenu vesselId={v.id} />
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
