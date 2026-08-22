"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useShipyardLanguage } from "@/components/shipyard/ShipyardLanguageProvider";
import type { ShipyardDashboardKpis } from "@/lib/shipyard/types";
import type { ShipyardQuoteUiKey } from "@/lib/i18n/shipyardQuotationUi";

const KPI_ITEMS: {
  key: keyof ShipyardDashboardKpis;
  labelKey: ShipyardQuoteUiKey;
}[] = [
  { key: "totalJobs", labelKey: "kpiTotalJobs" },
  { key: "jobsNotStarted", labelKey: "kpiNotStarted" },
  { key: "jobsInProgress", labelKey: "kpiInProgress" },
  { key: "jobsCompleted", labelKey: "kpiCompleted" },
  { key: "criticalPathJobs", labelKey: "kpiCriticalPath" },
  { key: "delayedJobs", labelKey: "kpiDelayed" },
  { key: "awaitingOwnerApproval", labelKey: "kpiAwaitingOwner" },
  { key: "awaitingClassInspection", labelKey: "kpiAwaitingClass" },
  { key: "awaitingMaterial", labelKey: "kpiAwaitingMaterial" },
  { key: "awaitingAccessStaging", labelKey: "kpiAccessStaging" },
  { key: "variationJobs", labelKey: "kpiVariationJobs" },
];

function kpiValue(kpis: ShipyardDashboardKpis, key: keyof ShipyardDashboardKpis): number {
  const v = kpis[key];
  if (typeof v === "number") return v;
  return 0;
}

export function ShipyardKpiGrid({ kpis }: { kpis: ShipyardDashboardKpis }) {
  const { t, label } = useShipyardLanguage();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {KPI_ITEMS.map(({ key, labelKey }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {kpiValue(kpis, key)}
              </CardTitle>
              <CardDescription>{label(labelKey)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tabular-nums">
              {t("scheduleHealthValue")
                .replace("{planned}", String(kpis.plannedVsActualPct.planned))
                .replace("{actual}", String(kpis.plannedVsActualPct.actual))}
            </CardTitle>
            <CardDescription>{label("scheduleHealth")}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tabular-nums">
              {t("commercialProgressValue").replace(
                "{pct}",
                String(kpis.budgetedVsWorkDone.workDone),
              )}
            </CardTitle>
            <CardDescription>{label("commercialProgress")}</CardDescription>
          </CardHeader>
        </Card>
        {kpis.activeProjects !== undefined ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-semibold tabular-nums">{kpis.activeProjects}</CardTitle>
              <CardDescription>{label("activeProjects")}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
