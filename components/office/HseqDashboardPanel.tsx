"use client";

import { useMemo } from "react";
import { OfficeDashboardPanel } from "@/components/office/OfficeDashboardPanel";

export function HseqDashboardPanel() {
  const mapStats = useMemo(
    () => (data: Record<string, unknown>) => {
      const stats = (data.stats ?? {}) as Record<string, number>;
      return [
        { label: "Open approvals", value: stats.openApprovals ?? 0 },
        { label: "Pending invoices", value: stats.pendingInvoices ?? 0 },
        { label: "Overdue checklist items", value: stats.overdueChecklistItems ?? 0 },
      ];
    },
    [],
  );

  return <OfficeDashboardPanel apiPath="/api/office/dashboards/hseq" mapStats={mapStats} />;
}
