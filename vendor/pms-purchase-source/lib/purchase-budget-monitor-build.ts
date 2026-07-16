import prisma from "@/lib/prisma";
import {
  computeBudgetExposureStatus,
  fetchCommittedByVesselAndBudgetCode,
  fetchSpendByVesselAndBudgetCode,
  spendMapKey,
  sumPurchaseOrderSpend,
  type BudgetVarianceActualsSource,
} from "@/lib/purchase-budget-variance";
import type { BudgetPostingBasis } from "@/lib/purchase-budget-posting-basis";
import type { findPurchaseBudgetsCompat } from "@/lib/purchase-budget-schema-compat";

type CompatBudget = Awaited<ReturnType<typeof findPurchaseBudgetsCompat>>[number];

export type BuiltBudgetStat = {
  id: string;
  budgetTypeId: string;
  budgetType: CompatBudget["budgetType"];
  section: string;
  vesselId: string;
  vessel: CompatBudget["vessel"];
  budgetYear: number;
  budgetMonth: number | null;
  monthlyAmount: number;
  yearlyAmount: number;
  dailyAmount: number;
  currency: string;
  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  exposureAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: ReturnType<typeof computeBudgetExposureStatus>["status"];
  period: string;
};

export async function buildBudgetStats(params: {
  budgets: CompatBudget[];
  startDate: Date;
  endDate: Date;
  actualsSource: BudgetVarianceActualsSource;
  postingBasis?: BudgetPostingBasis;
  hasRowFilters: boolean;
  requisitionType?: string | null;
  machineryFilterIds: string[];
}): Promise<BuiltBudgetStat[]> {
  const {
    budgets,
    startDate,
    endDate,
    actualsSource,
    postingBasis = "req_created",
    hasRowFilters,
    requisitionType,
    machineryFilterIds,
  } = params;

  const vesselIds = [...new Set(budgets.map((b) => b.vesselId))];

  const [spendMap, committedMap] = await Promise.all([
    fetchSpendByVesselAndBudgetCode({
      vesselIds,
      startDate,
      endDate,
      actualsSource,
      postingBasis,
    }),
    fetchCommittedByVesselAndBudgetCode({
      vesselIds,
      startDate,
      endDate,
      actualsSource,
    }),
  ]);

  return Promise.all(
    budgets.map(async (budget) => {
      const budgetCode = budget.budgetType.code;
      const key = spendMapKey(budget.vesselId, budgetCode);
      let spentAmount = spendMap.get(key) ?? 0;

      if (hasRowFilters) {
        const reqWhere: {
          vesselId: string;
          budgetCode: string;
          dateOfCreation: { gte: Date; lte: Date };
          requisitionType?: string;
          items?: { some: { machineryInstanceId: string | { in: string[] } } };
        } = {
          vesselId: budget.vesselId,
          budgetCode,
          dateOfCreation: { gte: startDate, lte: endDate },
        };
        if (requisitionType && requisitionType !== "all") {
          reqWhere.requisitionType = requisitionType;
        }
        if (machineryFilterIds.length === 1) {
          reqWhere.items = { some: { machineryInstanceId: machineryFilterIds[0] } };
        } else if (machineryFilterIds.length > 1) {
          reqWhere.items = { some: { machineryInstanceId: { in: machineryFilterIds } } };
        }

        if (actualsSource === "invoice") {
          const invoices = await prisma.invoice.findMany({
            where: {
              status: { notIn: ["CANCELLED", "RETURNED"] },
              requisition: reqWhere,
            },
            select: { invoiceAmount: true },
          });
          spentAmount = invoices.reduce((sum, i) => sum + (Number(i.invoiceAmount) || 0), 0);
        } else {
          const purchaseOrders = await prisma.purchaseOrder.findMany({
            where: {
              requisition: reqWhere,
              status: { not: "CANCELLED" },
            },
            select: { totalAmount: true },
          });
          spentAmount = sumPurchaseOrderSpend(purchaseOrders);
        }
      }

      const committedAmount = committedMap.get(key) ?? 0;
      const allocatedAmount = Number(budget.yearlyAmount);
      const { status, percentageUsed, exposure, remaining } = computeBudgetExposureStatus(
        spentAmount,
        committedAmount,
        allocatedAmount
      );

      return {
        id: budget.id,
        budgetTypeId: budget.budgetTypeId,
        budgetType: budget.budgetType,
        section: budget.budgetType.code,
        vesselId: budget.vesselId,
        vessel: budget.vessel,
        budgetYear: budget.budgetYear,
        budgetMonth: budget.budgetMonth,
        monthlyAmount: Number(budget.monthlyAmount),
        yearlyAmount: Number(budget.yearlyAmount),
        dailyAmount: Number(budget.dailyAmount),
        currency: budget.currency,
        allocatedAmount,
        committedAmount,
        spentAmount,
        exposureAmount: exposure,
        remainingAmount: remaining,
        percentageUsed,
        status,
        period: budget.budgetMonth
          ? `${budget.budgetYear}-${String(budget.budgetMonth).padStart(2, "0")}`
          : `${budget.budgetYear}`,
      };
    })
  );
}

export function sumUnbudgetedExposure(params: {
  vesselId: string;
  definedL2Codes: Set<string>;
  spendMap: Map<string, number>;
  committedMap: Map<string, number>;
}): { actual: number; committed: number } {
  let actual = 0;
  let committed = 0;
  const prefix = `${params.vesselId}::`;

  for (const [key, amount] of spendMap.entries()) {
    if (!key.startsWith(prefix)) continue;
    const code = key.slice(prefix.length);
    if (!code || params.definedL2Codes.has(code)) continue;
    actual += amount;
  }
  for (const [key, amount] of committedMap.entries()) {
    if (!key.startsWith(prefix)) continue;
    const code = key.slice(prefix.length);
    if (!code || params.definedL2Codes.has(code)) continue;
    committed += amount;
  }

  return { actual, committed };
}

/** Add non-procurement accrual actuals onto matching L2 budget stats. */
export function applyAccrualActualsToStats(
  stats: BuiltBudgetStat[],
  accrualByCode: Map<string, number>
): void {
  for (const stat of stats) {
    const code = stat.budgetType?.code?.trim();
    if (!code) continue;
    const accrual = accrualByCode.get(code) ?? 0;
    if (accrual <= 0) continue;
    stat.spentAmount += accrual;
    stat.exposureAmount = stat.spentAmount + stat.committedAmount;
    stat.remainingAmount = stat.allocatedAmount - stat.exposureAmount;
    stat.percentageUsed =
      stat.allocatedAmount > 0 ? (stat.exposureAmount / stat.allocatedAmount) * 100 : 0;
    stat.status = computeBudgetExposureStatus(stat.allocatedAmount, stat.exposureAmount).status;
  }
}
