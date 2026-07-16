import prisma from "@/lib/prisma";
import type { BudgetYearMonth } from "@/lib/purchase-budget-year-range";
import { yearMonthRangeToDateBounds } from "@/lib/purchase-budget-year-range";
import { roundBudgetAmount } from "@/lib/purchase-budget-amount-format";

export type PmsForecastMonthBucket = {
  year: number;
  month: number;
  amount: number;
  jobScheduleCount: number;
  defectCount: number;
  spareForecastCount: number;
};

export type PmsForecastSummary = {
  totalForecast: number;
  byMonth: Map<string, number>;
  buckets: PmsForecastMonthBucket[];
};

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type SparePartJson = { partNumber?: string; quantity?: number };

async function loadAvgUnitCostByPart(vesselId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ part_number: string; avg_cost: unknown }>>`
    SELECT c.part_number,
           COALESCE(AVG(c.unit_cost), 0) AS avg_cost
    FROM maintenance_spare_part_consumption c
    INNER JOIN maintenance_work_orders wo ON wo.id = c.work_order_id
    WHERE wo.vessel_id = ${vesselId}::uuid
      AND c.consumed_at >= NOW() - INTERVAL '18 months'
    GROUP BY c.part_number
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    const cost = Number(row.avg_cost) || 0;
    if (cost > 0) map.set(row.part_number, cost);
  }
  return map;
}

function estimateJobPlanCost(
  requiredSpareParts: unknown,
  avgCostByPart: Map<string, number>
): number {
  if (!requiredSpareParts || !Array.isArray(requiredSpareParts)) return 0;
  let total = 0;
  for (const raw of requiredSpareParts as SparePartJson[]) {
    const partNumber = String(raw.partNumber ?? "").trim();
    const qty = Number(raw.quantity) || 1;
    const unit = avgCostByPart.get(partNumber) ?? 0;
    total += unit * qty;
  }
  return total;
}

export async function computePmsBudgetForecast(params: {
  vesselId: string;
  rangeFrom: BudgetYearMonth;
  rangeTo: BudgetYearMonth;
}): Promise<PmsForecastSummary> {
  const { vesselId, rangeFrom, rangeTo } = params;
  const { startDate, endDate } = yearMonthRangeToDateBounds(rangeFrom, rangeTo);
  const avgCostByPart = await loadAvgUnitCostByPart(vesselId);

  const byMonth = new Map<string, number>();
  const bucketMeta = new Map<
    string,
    { jobScheduleCount: number; defectCount: number; spareForecastCount: number }
  >();

  const ensureBucket = (key: string) => {
    if (!bucketMeta.has(key)) {
      bucketMeta.set(key, { jobScheduleCount: 0, defectCount: 0, spareForecastCount: 0 });
    }
    if (!byMonth.has(key)) byMonth.set(key, 0);
    return bucketMeta.get(key)!;
  };

  const addAmount = (key: string, amount: number, kind: "job" | "defect" | "spare") => {
    const meta = ensureBucket(key);
    byMonth.set(key, (byMonth.get(key) ?? 0) + amount);
    if (kind === "job") meta.jobScheduleCount += 1;
    if (kind === "defect") meta.defectCount += 1;
    if (kind === "spare") meta.spareForecastCount += 1;
  };

  const schedules = await prisma.maintenanceJobSchedule.findMany({
    where: {
      vesselId,
      scheduledDate: { gte: startDate, lte: endDate },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      scheduledDate: true,
      jobPlan: { select: { requiredSpareParts: true, estimatedDuration: true } },
    },
    take: 500,
  });

  for (const sched of schedules) {
    const d = sched.scheduledDate;
    const key = monthKey(d.getFullYear(), d.getMonth() + 1);
    const spareCost = estimateJobPlanCost(sched.jobPlan?.requiredSpareParts, avgCostByPart);
    const laborProxy = (Number(sched.jobPlan?.estimatedDuration) || 0) * 50;
    addAmount(key, spareCost + laborProxy, "job");
  }

  const defects = await prisma.defect.findMany({
    where: {
      vesselId,
      plannedRepairDate: { gte: startDate, lte: endDate },
      status: { notIn: ["CLOSED", "COMPLETED", "VERIFIED"] },
      estimatedCost: { not: null },
    },
    select: { plannedRepairDate: true, estimatedCost: true },
    take: 200,
  });

  for (const defect of defects) {
    if (!defect.plannedRepairDate) continue;
    const d = defect.plannedRepairDate;
    const key = monthKey(d.getFullYear(), d.getMonth() + 1);
    addAmount(key, Number(defect.estimatedCost) || 0, "defect");
  }

  const spareForecasts = await prisma.maintenanceSparePartForecast.findMany({
    where: {
      vesselId,
      forecastDate: { gte: startDate, lte: endDate },
    },
    select: {
      forecastDate: true,
      partNumber: true,
      recommendedOrder: true,
    },
    take: 300,
  });

  for (const sf of spareForecasts) {
    const d = sf.forecastDate;
    const key = monthKey(d.getFullYear(), d.getMonth() + 1);
    const unit = avgCostByPart.get(sf.partNumber) ?? 0;
    const qty = Number(sf.recommendedOrder) || 0;
    if (unit > 0 && qty > 0) {
      addAmount(key, unit * qty, "spare");
    }
  }

  let totalForecast = 0;
  const buckets: PmsForecastMonthBucket[] = [];
  for (const [key, amount] of byMonth.entries()) {
    const [yStr, mStr] = key.split("-");
    const rounded = roundBudgetAmount(amount);
    totalForecast += rounded;
    const meta = bucketMeta.get(key)!;
    buckets.push({
      year: parseInt(yStr, 10),
      month: parseInt(mStr, 10),
      amount: rounded,
      jobScheduleCount: meta.jobScheduleCount,
      defectCount: meta.defectCount,
      spareForecastCount: meta.spareForecastCount,
    });
  }

  buckets.sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    totalForecast: roundBudgetAmount(totalForecast),
    byMonth,
    buckets,
  };
}
