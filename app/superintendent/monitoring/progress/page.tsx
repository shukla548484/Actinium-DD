"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { fmtPct } from "@/lib/superintendent/formatters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type ProjectProgress = {
  id: string;
  name: string;
  status: string;
  progressPct: number | null;
  vessel: { name: string; code: string };
};

export default function ProgressTrackerPage() {
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/superintendent/projects?limit=100")
      .then((r) => r.json())
      .then((d) => setProjects(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Progress tracker"
        description="Overall project completion trends across dry dock executions."
      />

      <TableCard title="Project progress">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${p.progressPct ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums">{fmtPct(p.progressPct)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </PageShell>
  );
}
