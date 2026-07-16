"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  PURCHASE_BUDGET_FUND_TYPE_LABELS,
  PURCHASE_BUDGET_FUND_TYPES,
} from "@/lib/purchase-budget-fund-type";

type AccrualEntry = {
  id: string;
  sourceType: string;
  accrualYear: number;
  accrualMonth: number;
  amount: unknown;
  currency: string;
  description: string | null;
  isRecurring: boolean;
  fundType: string;
  budgetType?: { code: string; name: string } | null;
};

type BudgetAccrualPanelProps = {
  vesselId: string;
  year: number;
  yearEnd: number;
  budgetScope: string;
  dryDockProjectId?: string | null;
  canEdit?: boolean;
  onChanged?: () => void;
};

const SOURCE_TYPES = [
  { value: "CREW_PAYROLL", label: "Crew payroll" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "MANAGEMENT_FEE", label: "Management fee" },
  { value: "RECURRING_OPEX", label: "Recurring OPEX" },
  { value: "OTHER", label: "Other" },
] as const;

export function BudgetAccrualPanel({
  vesselId,
  year,
  yearEnd,
  budgetScope,
  dryDockProjectId,
  canEdit = false,
  onChanged,
}: BudgetAccrualPanelProps) {
  const [entries, setEntries] = useState<AccrualEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceType, setSourceType] = useState<string>("CREW_PAYROLL");
  const [fundType, setFundType] = useState<string>("OPEX");
  const [month, setMonth] = useState("1");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        vesselId,
        year: String(year),
        yearEnd: String(yearEnd),
        budgetScope,
      });
      if (dryDockProjectId) params.set("dryDockProjectId", dryDockProjectId);
      const res = await fetch(`/api/purchase/budgets/accruals?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [vesselId, year, yearEnd, budgetScope, dryDockProjectId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleAdd = async () => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchase/budgets/accruals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vesselId,
          dryDockProjectId: dryDockProjectId ?? null,
          sourceType,
          fundType,
          accrualYear: year,
          accrualMonth: parseInt(month, 10),
          amount: parsed,
          description: description || null,
          isRecurring,
        }),
      });
      if (res.ok) {
        toast.success("Accrual added");
        setAmount("");
        setDescription("");
        await loadEntries();
        onChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to add accrual");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this accrual entry?")) return;
    const res = await fetch(`/api/purchase/budgets/accruals/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      toast.success("Accrual deleted");
      await loadEntries();
      onChanged?.();
    } else {
      toast.error("Failed to delete accrual");
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">Non-procurement OPEX accruals</h3>
        <p className="text-sm text-muted-foreground">
          Crew payroll, insurance, management fees, and other recurring costs not captured by POs.
        </p>
      </div>

      {canEdit && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <Label>Source</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fund</Label>
            <Select value={fundType} onValueChange={setFundType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURCHASE_BUDGET_FUND_TYPES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {PURCHASE_BUDGET_FUND_TYPE_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString("en", { month: "short" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring
            </label>
            <Button onClick={handleAdd} disabled={saving}>
              Add
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading accruals…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accrual entries for this period.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Fund</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  {e.accrualYear}-{String(e.accrualMonth).padStart(2, "0")}
                </TableCell>
                <TableCell>{e.sourceType.replace(/_/g, " ")}</TableCell>
                <TableCell>
                  {PURCHASE_BUDGET_FUND_TYPE_LABELS[
                    e.fundType as keyof typeof PURCHASE_BUDGET_FUND_TYPE_LABELS
                  ] ?? e.fundType}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(e.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {e.currency}
                </TableCell>
                <TableCell>{e.description ?? "—"}</TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(e.id)}>
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
