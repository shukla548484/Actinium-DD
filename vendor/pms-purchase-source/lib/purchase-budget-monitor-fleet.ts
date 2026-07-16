import prisma from "@/lib/prisma";
import { BASE_CURRENCY } from "@/lib/utils/currency-shared";
import { convertWithSource } from "@/lib/utils/currency";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";
import {
  loadPurchaseBudgetMonitorPayload,
  type PurchaseBudgetMonitorQuery,
} from "@/lib/purchase-budget-monitor-load";
import { computeBudgetExposureStatus } from "@/lib/purchase-budget-spend";

export type BudgetFleetMonitorRow = {
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  nativeCurrency: string;
  allocated: number;
  committed: number;
  actual: number;
  exposure: number;
  remaining: number;
  utilizationPct: number;
  status: ReturnType<typeof computeBudgetExposureStatus>["status"];
};

export type BudgetFleetMonitorPayload = {
  displayCurrency: string;
  fxNote: string;
  periodLabel: string;
  fleetTotals: Omit<BudgetFleetMonitorRow, "vesselId" | "vesselName" | "vesselCode" | "nativeCurrency">;
  vessels: BudgetFleetMonitorRow[];
  warningCount: number;
  exceededCount: number;
};

async function convertMonitorAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOfDate: Date
): Promise<number> {
  if (!amount || fromCurrency === toCurrency) return amount;
  const result = await convertWithSource(amount, fromCurrency, toCurrency, { asOfDate });
  return roundBudgetAmount(result.amount);
}

export async function loadFleetBudgetMonitorPayload(params: {
  vesselIds: string[];
  query: Omit<PurchaseBudgetMonitorQuery, "vesselId">;
  displayCurrency?: string;
}): Promise<BudgetFleetMonitorPayload> {
  const displayCurrency = (params.displayCurrency ?? BASE_CURRENCY).toUpperCase();
  const asOfDate = new Date();
  const vessels = await prisma.vessel.findMany({
    where: { id: { in: params.vesselIds }, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const rows: BudgetFleetMonitorRow[] = [];
  let periodLabel = "";

  for (const vessel of vessels) {
    const payload = await loadPurchaseBudgetMonitorPayload({
      ...params.query,
      vesselId: vessel.id,
    });
    if (!periodLabel) periodLabel = payload.periodLabel;

    const nativeCurrency = payload.stats.currency;
    const allocated = await convertMonitorAmount(
      payload.stats.allocatedBudget,
      nativeCurrency,
      displayCurrency,
      asOfDate
    );
    const committed = await convertMonitorAmount(
      payload.stats.committedBudget,
      nativeCurrency,
      displayCurrency,
      asOfDate
    );
    const actual = await convertMonitorAmount(
      payload.stats.spentBudget,
      nativeCurrency,
      displayCurrency,
      asOfDate
    );
    const exposure = await convertMonitorAmount(
      payload.stats.exposureBudget,
      nativeCurrency,
      displayCurrency,
      asOfDate
    );
    const remaining = await convertMonitorAmount(
      payload.stats.remainingBudget,
      nativeCurrency,
      displayCurrency,
      asOfDate
    );
    const { status, percentageUsed } = computeBudgetExposureStatus(
      actual,
      committed,
      allocated
    );

    if (allocated <= 0 && exposure <= 0) continue;

    rows.push({
      vesselId: vessel.id,
      vesselName: vessel.name,
      vesselCode: vessel.code ?? "—",
      nativeCurrency,
      allocated,
      committed,
      actual,
      exposure,
      remaining,
      utilizationPct: percentageUsed,
      status,
    });
  }

  rows.sort((a, b) => b.utilizationPct - a.utilizationPct || b.exposure - a.exposure);

  const fleetTotals = rows.reduce(
    (acc, row) => ({
      allocated: acc.allocated + row.allocated,
      committed: acc.committed + row.committed,
      actual: acc.actual + row.actual,
      exposure: acc.exposure + row.exposure,
      remaining: acc.remaining + row.remaining,
      utilizationPct: 0,
      status: "ON_TRACK" as const,
    }),
    {
      allocated: 0,
      committed: 0,
      actual: 0,
      exposure: 0,
      remaining: 0,
      utilizationPct: 0,
      status: "ON_TRACK" as const,
    }
  );

  fleetTotals.utilizationPct =
    fleetTotals.allocated > 0
      ? roundBudgetAmount((fleetTotals.exposure / fleetTotals.allocated) * 100)
      : 0;
  const fleetStatus = computeBudgetExposureStatus(
    fleetTotals.actual,
    fleetTotals.committed,
    fleetTotals.allocated
  );
  fleetTotals.status = fleetStatus.status;

  const warningCount = rows.filter((r) => r.status === "WARNING").length;
  const exceededCount = rows.filter((r) => r.status === "EXCEEDED").length;

  const hasMixedCurrency = rows.some((r) => r.nativeCurrency !== displayCurrency);

  return {
    displayCurrency,
    fxNote: hasMixedCurrency
      ? `Amounts converted to ${displayCurrency} using company/market rates as of today. Native currency shown per vessel in drill-through.`
      : `All vessels report in ${displayCurrency}.`,
    periodLabel,
    fleetTotals,
    vessels: rows,
    warningCount,
    exceededCount,
  };
}
