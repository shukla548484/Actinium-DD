"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  BUDGET_PERIOD_TYPE_OPTIONS,
  deriveBudgetDisplayAmounts,
  matchesBudgetPeriod,
  monthlyToPeriodAmount,
  periodAmountToMonthly,
  allocatedBudgetColumnLabel,
  resolveBudgetPeriodSpan,
  type BudgetPeriodType,
} from "@/lib/purchase-budget-period";
import {
  clampMonthToBudgetRange,
  formatBudgetYearMonthRangeLabel,
  monthsWithinBudgetRange,
} from "@/lib/purchase-budget-year-range";
import { buildPurchaseBudgetPeriodCode } from "@/lib/purchase-budget-period-code";
import { buildGroupedBudgetTableRows } from "@/lib/purchase-budget-grouped-rows";
import { cn } from "@/lib/utils";
import {
  PURCHASE_BUDGET_SCOPE,
  type PurchaseBudgetScope,
} from "@/lib/purchase-budget-scope";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import {
  BUDGET_AMOUNT_DECIMAL_PLACES,
  formatBudgetAmount,
  formatBudgetAmountForInput,
  roundBudgetAmount,
} from "@/lib/purchase-budget-amount-format";

export interface BudgetTypeRow {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  level: number;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
}

interface BudgetRecord {
  id: string;
  budgetTypeId: string;
  budgetYear: number;
  budgetYearEnd?: number | null;
  budgetMonth: number | null;
  budgetQuarter?: number | null;
  budgetPeriodCode?: string | null;
  monthlyAmount: number;
  currency: string;
}

export interface BudgetDefinePeriodContext {
  periodType: BudgetPeriodType;
  month: number;
  quarter: 1 | 2 | 3 | 4;
}

export interface BudgetDefineMatrixProps {
  vesselId: string;
  budgetYear: number;
  budgetYearEnd: number;
  rangeFromMonth?: number;
  rangeToMonth?: number;
  budgetScope?: PurchaseBudgetScope;
  /** When set, budgets are scoped to this dry dock project. */
  dryDockProjectId?: string;
  level1Types: BudgetTypeRow[];
  level2Types: BudgetTypeRow[];
  /** When false, grid is read-only (view access without edit permission). */
  canEdit?: boolean;
  onSaved?: () => void;
  /** Fired when the user changes budget period controls (drives allocated column + charts). */
  onPeriodContextChange?: (ctx: BudgetDefinePeriodContext) => void;
  /** Seeds period type / month / quarter on mount (remount when declaration or scope changes). */
  initialPeriodContext?: BudgetDefinePeriodContext;
  /** When set, loads the exact saved declaration for editing. */
  selectedDeclarationCode?: string;
  /** True when editing a previously saved declaration (changes save label). */
  isEditingExisting?: boolean;
}

type GridCell = { amount: string; budgetId?: string; currency: string };

export function BudgetDefineMatrix({
  vesselId,
  budgetYear,
  budgetYearEnd,
  rangeFromMonth = 1,
  rangeToMonth = 12,
  budgetScope = "NORMAL",
  dryDockProjectId,
  level1Types,
  level2Types,
  canEdit = true,
  onSaved,
  onPeriodContextChange,
  initialPeriodContext,
  selectedDeclarationCode,
  isEditingExisting = false,
}: BudgetDefineMatrixProps) {
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(() => {
    if (initialPeriodContext?.periodType) return initialPeriodContext.periodType;
    return budgetScope === PURCHASE_BUDGET_SCOPE.DRY_DOCK ? "dry_docking" : "yearly";
  });
  const [defineMonth, setDefineMonth] = useState<number>(
    () => initialPeriodContext?.month ?? new Date().getMonth() + 1
  );
  const [defineQuarter, setDefineQuarter] = useState<1 | 2 | 3 | 4>(() => {
    if (initialPeriodContext?.quarter) return initialPeriodContext.quarter;
    const month = initialPeriodContext?.month ?? new Date().getMonth() + 1;
    return Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  });
  const [currency, setCurrency] = useState("USD");
  const [grid, setGrid] = useState<Record<string, GridCell>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const groupedRows = useMemo(
    () => buildGroupedBudgetTableRows(level1Types, level2Types),
    [level1Types, level2Types]
  );

  const level2TypesRef = useRef(level2Types);
  level2TypesRef.current = level2Types;
  const currencyRef = useRef(currency);
  currencyRef.current = currency;

  const rangeFrom = useMemo(
    () => ({ year: budgetYear, month: rangeFromMonth }),
    [budgetYear, rangeFromMonth]
  );
  const rangeTo = useMemo(
    () => ({ year: budgetYearEnd, month: rangeToMonth }),
    [budgetYearEnd, rangeToMonth]
  );
  const periodSpan = useMemo(
    () => resolveBudgetPeriodSpan(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );
  const allowedMonths = useMemo(
    () => monthsWithinBudgetRange(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );

  const budgetPeriodCode = useMemo(
    () =>
      buildPurchaseBudgetPeriodCode({
        budgetYear,
        budgetYearEnd,
        budgetMonth: periodType === "monthly" ? defineMonth : null,
        budgetQuarter: periodType === "quarterly" ? defineQuarter : null,
        periodType,
        rangeFromMonth,
        rangeToMonth,
      }),
    [
      budgetYear,
      budgetYearEnd,
      defineMonth,
      defineQuarter,
      periodType,
      rangeFromMonth,
      rangeToMonth,
    ]
  );

  const emitPeriodContext = useCallback(
    (overrides: Partial<BudgetDefinePeriodContext> = {}) => {
      onPeriodContextChange?.({
        periodType: overrides.periodType ?? periodType,
        month: overrides.month ?? defineMonth,
        quarter: overrides.quarter ?? defineQuarter,
      });
    },
    [onPeriodContextChange, periodType, defineMonth, defineQuarter]
  );

  useEffect(() => {
    const clamped = clampMonthToBudgetRange(defineMonth, rangeFrom, rangeTo);
    if (clamped === defineMonth) return;
    setDefineMonth(clamped);
    emitPeriodContext({ month: clamped });
  }, [rangeFrom, rangeTo, defineMonth, emitPeriodContext]);

  const loadGrid = useCallback(async (signal?: AbortSignal) => {
    if (!vesselId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        vesselId,
        year: String(budgetYear),
        yearEnd: String(budgetYearEnd),
        monthFrom: String(rangeFromMonth),
        monthTo: String(rangeToMonth),
        periodType,
        budgetScope,
      });
      if (dryDockProjectId) params.set("dryDockProjectId", dryDockProjectId);
      if (periodType === "monthly") {
        params.set("month", String(defineMonth));
      }
      if (periodType === "quarterly") {
        params.set("quarter", String(defineQuarter));
      }
      if (selectedDeclarationCode) {
        params.set("budgetPeriodCode", selectedDeclarationCode);
      }

      const expectedCode = selectedDeclarationCode || buildPurchaseBudgetPeriodCode({
        budgetYear,
        budgetYearEnd,
        budgetMonth: periodType === "monthly" ? defineMonth : null,
        budgetQuarter: periodType === "quarterly" ? defineQuarter : null,
        periodType,
        rangeFromMonth,
        rangeToMonth,
      });

      const response = await fetch(`/api/purchase/budgets?${params}`, {
        credentials: "include",
        signal,
      });
      if (signal?.aborted) return;
      if (!response.ok) {
        toast.error("Failed to load budgets");
        return;
      }
      const data = await response.json();
      const list: BudgetRecord[] = (data.budgets || []).map(
        (b: BudgetRecord & { monthlyAmount: string | number }) => ({
          ...b,
          monthlyAmount: Number(b.monthlyAmount),
        })
      );

      const l2List = level2TypesRef.current;
      const span = resolveBudgetPeriodSpan(
        { year: budgetYear, month: rangeFromMonth },
        { year: budgetYearEnd, month: rangeToMonth }
      );
      const next: Record<string, GridCell> = {};
      for (const l2 of l2List) {
        const match = list.find(
          (b) =>
            b.budgetTypeId === l2.id &&
            (b.budgetPeriodCode === expectedCode ||
              matchesBudgetPeriod(
                b.budgetMonth,
                b.budgetQuarter,
                periodType,
                defineMonth,
                defineQuarter
              ))
        );
        next[l2.id] = {
          amount: match
            ? formatBudgetAmountForInput(
                monthlyToPeriodAmount(match.monthlyAmount, periodType, span)
              )
            : "",
          budgetId: match?.id,
          currency: match?.currency ?? currencyRef.current,
        };
      }
      setGrid(next);
      const firstWithCurrency = list.find((b) => b.currency);
      if (firstWithCurrency?.currency) {
        setCurrency((prev) =>
          prev === firstWithCurrency.currency ? prev : firstWithCurrency.currency
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error(e);
      toast.error("Error loading budgets");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [
    vesselId,
    budgetYear,
    budgetYearEnd,
    budgetScope,
    dryDockProjectId,
    periodType,
    defineMonth,
    defineQuarter,
    rangeFromMonth,
    rangeToMonth,
    selectedDeclarationCode,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void loadGrid(controller.signal);
    return () => controller.abort();
  }, [loadGrid, level2Types]);

  const setCellAmount = (l2Id: string, amount: string) => {
    setGrid((prev) => ({
      ...prev,
      [l2Id]: {
        amount,
        budgetId: prev[l2Id]?.budgetId,
        currency: prev[l2Id]?.currency ?? currency,
      },
    }));
  };

  const handlePeriodTypeChange = (nextType: BudgetPeriodType) => {
    setGrid((prev) => {
      const next: Record<string, GridCell> = { ...prev };
      for (const l2 of level2Types) {
        const cell = prev[l2.id];
        if (!cell?.amount) {
          next[l2.id] = cell ?? { amount: "", currency };
          continue;
        }
        const parsed = parseFloat(cell.amount);
        if (Number.isNaN(parsed)) {
          next[l2.id] = cell;
          continue;
        }
        const monthly = periodAmountToMonthly(parsed, periodType, periodSpan);
        next[l2.id] = {
          ...cell,
          amount: formatBudgetAmountForInput(
            monthlyToPeriodAmount(monthly, nextType, periodSpan)
          ),
        };
      }
      return next;
    });
    setPeriodType(nextType);
    emitPeriodContext({ periodType: nextType });
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      toast.error("You do not have permission to define budgets (access level 40+ required)");
      return;
    }
    if (!vesselId) return;
    const toSave = level2Types.filter((l2) => {
      const amountStr = grid[l2.id]?.amount;
      if (amountStr == null || amountStr === "") return false;
      const amount = parseFloat(amountStr);
      return !Number.isNaN(amount);
    });

    if (toSave.length === 0) {
      toast.error("Enter at least one budget amount");
      return;
    }

    setSaving(true);
    let ok = 0;
    let fail = 0;

    const budgetMonth = periodType === "monthly" ? defineMonth : null;
    const budgetQuarter = periodType === "quarterly" ? defineQuarter : null;

    try {
      for (const l2 of toSave) {
        const cell = grid[l2.id];
        if (!cell) continue;
        const amount = roundBudgetAmount(parseFloat(cell.amount));
        if (Number.isNaN(amount) || amount < 0) continue;

        const payload: Record<string, unknown> = {
          vesselId,
          budgetTypeId: l2.id,
          budgetYear,
          budgetYearEnd,
          periodType,
          budgetPeriodType: periodType,
          budgetPeriodCode,
          monthsInRange: periodSpan.monthsInRange,
          amount,
          currency,
        };
        if (dryDockProjectId) payload.dryDockProjectId = dryDockProjectId;
        if (periodType === "monthly") payload.budgetMonth = defineMonth;
        if (periodType === "quarterly") payload.budgetQuarter = defineQuarter;

        const url = cell.budgetId
          ? `/api/purchase/budgets/${cell.budgetId}`
          : "/api/purchase/budgets";
        const method = cell.budgetId ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            cell.budgetId
              ? {
                  periodType,
                  amount,
                  currency,
                  monthsInRange: periodSpan.monthsInRange,
                  budgetPeriodCode,
                }
              : payload
          ),
        });

        if (response.ok) {
          ok++;
        } else {
          fail++;
          const err = await response.json().catch(() => ({}));
          console.warn("Budget save failed", l2.code, err);
        }
      }

      if (fail === 0) {
        toast.success(`Saved ${ok} budget${ok === 1 ? "" : "s"}`);
      } else {
        toast.warning(`Saved ${ok}; ${fail} failed`);
      }
      await loadGrid();
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error("Error saving budgets");
    } finally {
      setSaving(false);
    }
  };

  const amountLabel = allocatedBudgetColumnLabel(periodType);

  const formatDerived = (value: number) => formatBudgetAmount(value);

  const derivedForCell = (amountStr: string) => {
    const parsed = parseFloat(amountStr);
    if (amountStr === "" || Number.isNaN(parsed)) return null;
    return deriveBudgetDisplayAmounts(parsed, periodType, periodSpan);
  };

  if (level2Types.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No Level 2 budget codes loaded. Open the <strong>Budget Categories</strong> tab, download the
          Excel template, and upload your company codes.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Define allocated budget by L1 / L2 codes</CardTitle>
          <CardDescription>
            Define budgets for period{" "}
            <strong>
              {formatBudgetYearMonthRangeLabel(
                { year: budgetYear, month: rangeFromMonth },
                { year: budgetYearEnd, month: rangeToMonth }
              )}
            </strong>
            . Budget declaration ID:{" "}
            <strong className="font-mono">{budgetPeriodCode}</strong>. Enter allocated amounts for the
            selected budget period/type; values are normalized to monthly using{" "}
            {periodSpan.monthsInRange} month{periodSpan.monthsInRange === 1 ? "" : "s"} in this range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[180px]">
              <Label>Budget Period/Type</Label>
              <Select
                value={periodType}
                onValueChange={(v) => handlePeriodTypeChange(v as BudgetPeriodType)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_PERIOD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {periodType === "monthly" && (
              <div className="space-y-1.5 min-w-[160px]">
                <Label>Month</Label>
                <Select
                  value={String(defineMonth)}
                  onValueChange={(v) => {
                    const month = parseInt(v, 10);
                    setDefineMonth(month);
                    emitPeriodContext({ month });
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedMonths.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodType === "quarterly" && (
              <div className="space-y-1.5 min-w-[120px]">
                <Label>Quarter</Label>
                <Select
                  value={String(defineQuarter)}
                  onValueChange={(v) => {
                    const quarter = parseInt(v, 10) as 1 | 2 | 3 | 4;
                    setDefineQuarter(quarter);
                    emitPeriodContext({ quarter });
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                    <SelectItem value="2">Q2 (Apr–Jun)</SelectItem>
                    <SelectItem value="3">Q3 (Jul–Sep)</SelectItem>
                    <SelectItem value="4">Q4 (Oct–Dec)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5 min-w-[100px]">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={!canEdit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveAll} disabled={!canEdit || saving || loading}>
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditingExisting ? "Save budget changes" : "Save all budgets"}
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading budget grid…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableSerialHead />
                    <TableHead className="border-r min-w-[180px]">L1 Budget ID</TableHead>
                    <TableHead className="border-r w-[100px] text-center">L1 Budget Code</TableHead>
                    <TableHead className="border-r min-w-[180px]">L2 Budget ID</TableHead>
                    <TableHead className="border-r w-[100px] text-center">L2 Budget Code</TableHead>
                    <TableHead className="text-right min-w-[120px]">
                      {amountLabel} ({currency})
                    </TableHead>
                    <TableHead className="text-right min-w-[100px] text-muted-foreground">
                      Monthly (calc)
                    </TableHead>
                    <TableHead className="text-right min-w-[100px] text-muted-foreground">
                      Quarterly (calc)
                    </TableHead>
                    <TableHead className="text-right min-w-[100px] text-muted-foreground">
                      Yearly (calc)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRows.map(({ l1, l2, isFirstInL1Group, l1RowSpan }, rowIndex) => {
                    const derived = derivedForCell(grid[l2.id]?.amount ?? "");
                    return (
                    <TableRow
                      key={l2.id}
                      className={cn(
                        isFirstInL1Group && l1.id !== "__orphan_l2__" && "border-t-2 border-t-border"
                      )}
                    >
                      <TableSerialCell serialNo={rowIndex + 1} />
                      {isFirstInL1Group ? (
                        <>
                          <TableCell
                            rowSpan={l1RowSpan}
                            className="border-r align-top bg-muted/25 font-medium"
                          >
                            {l1.name}
                          </TableCell>
                          <TableCell
                            rowSpan={l1RowSpan}
                            className="border-r align-middle text-center font-mono text-sm bg-muted/25"
                          >
                            {l1.code}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="border-r">{l2.name}</TableCell>
                      <TableCell className="border-r text-center font-mono text-sm">
                        {l2.code}
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number"
                          min={0}
                          step={10 ** -BUDGET_AMOUNT_DECIMAL_PLACES}
                          className="h-8 text-right text-sm"
                          placeholder={`0.${"0".repeat(BUDGET_AMOUNT_DECIMAL_PLACES)}`}
                          value={grid[l2.id]?.amount ?? ""}
                          onChange={(e) => setCellAmount(l2.id, e.target.value)}
                          onBlur={(e) => {
                            const parsed = parseFloat(e.target.value);
                            if (e.target.value !== "" && !Number.isNaN(parsed)) {
                              setCellAmount(l2.id, formatBudgetAmountForInput(parsed));
                            }
                          }}
                          disabled={!canEdit}
                          readOnly={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {derived ? formatDerived(derived.monthlyAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {derived ? formatDerived(derived.quarterlyAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {derived ? formatDerived(derived.yearlyAmount) : "—"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
