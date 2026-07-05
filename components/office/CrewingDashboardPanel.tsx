"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { OfficeDashboardPanel } from "@/components/office/OfficeDashboardPanel";

export function CrewingDashboardPanel() {
  const mapStats = useMemo(
    () => (data: Record<string, unknown>) => {
      const stats = (data.stats ?? {}) as Record<string, number>;
      return [
        { label: "Active employees", value: stats.activeEmployees ?? 0 },
        { label: "Waiting assignment", value: stats.waitingAssignment ?? 0 },
        { label: "Inactive", value: stats.inactive ?? 0 },
        { label: "Active vessels", value: stats.activeVessels ?? 0 },
      ];
    },
    [],
  );

  const [rows, setRows] = useState<{ designation: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/office/dashboards/crewing");
      const data = (await res.json()) as {
        stats?: { topDesignations?: { designation: string; count: number }[] };
      };
      if (res.ok) setRows(data.stats?.topDesignations ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <OfficeDashboardPanel apiPath="/api/office/dashboards/crewing" mapStats={mapStats} />
      {rows.length > 0 ? (
        <Card>
          <CardContent className="py-4">
            <p className="mb-3 text-sm font-medium">Top designations (active)</p>
            <ul className="space-y-1 text-sm">
              {rows.map((r) => (
                <li key={r.designation} className="flex justify-between">
                  <span>{r.designation}</span>
                  <span className="tabular-nums text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
