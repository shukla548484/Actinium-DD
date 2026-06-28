"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BudgetVsQuoteSummary } from "@/lib/superintendent/budgetFromComparison";
import { fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

export function BudgetVsQuotePanel({
  dryDockProjectId,
  tenderProjectId,
}: {
  dryDockProjectId: string;
  tenderProjectId?: string | null;
}) {
  const [summary, setSummary] = useState<BudgetVsQuoteSummary | null>(null);
  const [yardInviteId, setYardInviteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenderProjectId) return;
    setLoading(true);
    setError(null);
    const qs = yardInviteId ? `?yardInviteId=${encodeURIComponent(yardInviteId)}` : "";
    const res = await fetch(
      `/api/superintendent/projects/${dryDockProjectId}/comparison${qs}`,
    );
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Could not load comparison");
      setSummary(null);
    } else {
      const d = (await res.json()) as { summary: BudgetVsQuoteSummary };
      setSummary(d.summary);
      if (!yardInviteId && d.summary.selectedYardInviteId) {
        setYardInviteId(d.summary.selectedYardInviteId);
      }
    }
    setLoading(false);
  }, [dryDockProjectId, tenderProjectId, yardInviteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const yardItems = useMemo(
    () => (summary?.yards ? mapSelectItems(summary.yards, (y) => y.id, (y) => y.name) : []),
    [summary?.yards],
  );

  async function syncBudget() {
    setSyncing(true);
    const res = await fetch(
      `/api/superintendent/projects/${dryDockProjectId}/sync-budget`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yardInviteId: yardInviteId || null }),
      },
    );
    setSyncing(false);
    if (res.ok) await load();
    else {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Sync failed");
    }
  }

  if (!tenderProjectId) {
    return (
      <TableCard title="Budget vs quote">
        <p className="p-4 text-sm text-muted-foreground">
          Link a tender project in project settings to compare yard quotes against budget.
        </p>
      </TableCard>
    );
  }

  return (
    <TableCard title="Budget vs quote">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {summary?.yards.length ? (
            <Select
              items={yardItems}
              value={yardInviteId || summary.selectedYardInviteId || null}
              onValueChange={(v) => setYardInviteId(v ?? "")}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select yard quote" />
              </SelectTrigger>
              <SelectContent>
                {summary.yards.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => void syncBudget()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync quoted amounts to budget lines"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/projects/${tenderProjectId}`} />}
            nativeButton={false}
          >
            Open tender comparison
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {summary ? (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Budget total: <strong>{fmtMoney(summary.budgetGrandTotal)}</strong>
              </span>
              <span>
                Selected quote: <strong>{fmtMoney(summary.quotedGrandTotal)}</strong>
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Var %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.categoryLabel}</TableCell>
                    <TableCell className="text-right">{fmtMoney(row.budgetAmount)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(row.quotedAmount)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(row.variance)}</TableCell>
                    <TableCell className="text-right">{fmtPct(row.variancePct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </div>
    </TableCard>
  );
}
