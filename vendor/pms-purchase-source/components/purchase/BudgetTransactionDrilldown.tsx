"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BudgetMonitorTransaction } from "@/app/api/purchase/budgets/monitor/transactions/route";
import type { BudgetDrilldownTarget } from "@/components/purchase/BudgetVsActualSummaryTable";

type BudgetTransactionDrilldownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: BudgetDrilldownTarget | null;
  monthKey?: string | null;
  queryParams: URLSearchParams;
  formatCurrency: (amount: number, currency?: string) => string;
};

export function BudgetTransactionDrilldown({
  open,
  onOpenChange,
  target,
  monthKey,
  queryParams,
  formatCurrency,
}: BudgetTransactionDrilldownProps) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<BudgetMonitorTransaction[]>([]);

  useEffect(() => {
    if (!open || !target) {
      setTransactions([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams(queryParams);
    if (target.missingCodeOnly) {
      params.set("missingCodeOnly", "true");
    } else if (target.unbudgetedOnly) {
      params.set("unbudgetedOnly", "true");
    } else if (target.l1Id) {
      params.set("l1BudgetTypeId", target.l1Id);
    }
    params.set("kind", target.kind ?? "actual");
    if (monthKey) params.set("monthKey", monthKey);

    void fetch(`/api/purchase/budgets/monitor/transactions?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        setTransactions(json.transactions ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setTransactions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, target, monthKey, queryParams]);

  const title = target
    ? `${target.kind === "committed" ? "Committed" : "Actual"} — ${target.l1Label}`
    : "Transactions";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {monthKey ? `Period month: ${monthKey}` : "Full selected period"}
            {" · "}Real procurement data from the database
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading transactions…</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={`${tx.sourceType}-${tx.id}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono text-xs">{tx.reference}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{tx.description}</p>
                        {tx.requisitionId ? (
                          <Link
                            href={`/purchase/requisitions/${tx.requisitionId}/view`}
                            className="text-xs text-primary hover:underline"
                          >
                            View requisition
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{tx.budgetCode}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(tx.amount, tx.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
