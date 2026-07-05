"use client";

import { useMemo } from "react";
import { OfficeDashboardPanel } from "@/components/office/OfficeDashboardPanel";

export function FleetDashboardPanel() {
  const mapStats = useMemo(
    () => (data: Record<string, unknown>) => {
      const stats = (data.stats ?? {}) as Record<string, number>;
      return [
        { label: "Active vessels", value: stats.activeVessels ?? 0 },
        { label: "Dry docks in execution", value: stats.dryDockActive ?? 0 },
        { label: "Dry docks in planning", value: stats.dryDockPlanning ?? 0 },
        { label: "Active employees", value: stats.activeEmployees ?? 0 },
        { label: "Crew assignments", value: stats.crewAssignments ?? 0 },
      ];
    },
    [],
  );

  return <OfficeDashboardPanel apiPath="/api/office/dashboards/fleet" mapStats={mapStats} />;
}
