"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { fmtPct } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DD_PROJECT_STATUS_ITEMS } from "@/lib/superintendent/constants";

export const dynamic = "force-dynamic";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progressPct: number | null;
};

type VesselSummary = { id: string; code: string; name: string };

export default function VesselProjectStatusPage() {
  const { id: vesselId } = useParams<{ id: string }>();
  const [vessel, setVessel] = useState<VesselSummary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    const res = await fetch(`/api/superintendent/projects?vesselId=${vesselId}&limit=100`);
    const data = await res.json();
    const rows = (data.items ?? []) as ProjectRow[];
    setProjects(rows);
    setStatusById(Object.fromEntries(rows.map((p) => [p.id, p.status])));
    setLoading(false);
  }

  useEffect(() => {
    void fetch(`/api/superintendent/vessels/${vesselId}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.vessel as VesselSummary | undefined;
        if (v) setVessel({ id: v.id, code: v.code, name: v.name });
      });
    void loadProjects();
  }, [vesselId]);

  async function updateStatus(projectId: string) {
    const status = statusById[projectId];
    if (!status) return;

    setSavingId(projectId);
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/superintendent/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    setSavingId(null);

    if (!res.ok) {
      setError(data.error ?? "Failed to update status");
      return;
    }

    setMessage(`Updated status for "${(data.project as ProjectRow).name}".`);
    void loadProjects();
  }

  const base = `/superintendent/vessels/${vesselId}/projects`;

  return (
    <PageShell>
      <PageHeader
        title="Update project status"
        description={
          vessel
            ? `Change dry dock project status for ${vessel.name} (${vessel.code}).`
            : "Change dry dock project status for this vessel."
        }
        actions={
          <Button variant="outline" render={<Link href={base} />} nativeButton={false}>
            View projects
          </Button>
        }
      />

      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <TableCard title="Project status">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>New status</TableHead>
                <TableHead className="w-28 text-right">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No projects for this vessel.{" "}
                    <Link href={`${base}/new`} className="text-primary hover:underline">
                      Create project
                    </Link>
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
                      <p className="text-xs capitalize text-muted-foreground">
                        Current: {p.status.replace(/_/g, " ")}
                      </p>
                    </TableCell>
                    <TableCell>{fmtPct(p.progressPct)}</TableCell>
                    <TableCell>
                      <LabeledSelect
                        items={DD_PROJECT_STATUS_ITEMS}
                        value={statusById[p.id] ?? p.status}
                        onValueChange={(v) =>
                          setStatusById((prev) => ({ ...prev, [p.id]: v }))
                        }
                        className="w-full min-w-[10rem]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === p.id || statusById[p.id] === p.status}
                        onClick={() => void updateStatus(p.id)}
                      >
                        {savingId === p.id ? "Saving…" : "Update"}
                      </Button>
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
