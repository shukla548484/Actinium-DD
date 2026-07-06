"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BudgetRow = {
  projectId: string;
  code: string | null;
  name: string;
  budget: number;
  actual: number;
  poCommitted: number;
  invoiced: number;
  variance: number;
};

type Summary = {
  totals: {
    budget: number;
    actual: number;
    poCommitted: number;
    invoiced: number;
    variance: number;
  };
  projects: BudgetRow[];
};

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export function ExecutiveBudgetPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/office/dashboards/executive");
      const data = (await res.json()) as Summary & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load budget summary");
        return;
      }
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ActiniumLoadingState label="Loading budget summary…" size="sm" />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!summary) return null;

  const { totals, projects } = summary;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total budget", value: fmt(totals.budget) },
          { label: "Actual spend", value: fmt(totals.actual) },
          { label: "PO committed", value: fmt(totals.poCommitted) },
          { label: "Invoiced", value: fmt(totals.invoiced) },
          { label: "Variance", value: fmt(totals.variance) },
        ].map((m) => (
          <Card key={m.label}>
            <CardContent className="py-4">
              <p className="text-xl font-semibold tabular-nums">{m.value}</p>
              <p className="text-sm text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">PO</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active dry dock projects.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
                  <TableRow key={p.projectId}>
                    <TableCell>
                      <span className="font-medium">{p.code ?? p.projectId.slice(0, 8)}</span>
                      <span className="ml-2 text-muted-foreground">{p.name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.budget)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.actual)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.poCommitted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.invoiced)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(p.variance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
