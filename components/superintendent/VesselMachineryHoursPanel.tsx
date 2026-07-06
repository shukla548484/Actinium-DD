"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VesselMachineryHoursDto } from "@/lib/db/vesselMachineryHours";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  dryDockProjectId: string;
};

function formatHours(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

export function VesselMachineryHoursPanel({ dryDockProjectId }: Props) {
  const [hours, setHours] = useState<VesselMachineryHoursDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superintendent/vessel-machinery-hours?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`,
      );
      const data = (await res.json()) as { hours?: VesselMachineryHoursDto; error?: string };
      if (!res.ok || !data.hours) {
        setError(data.error ?? "Failed to load running hours");
        setHours(null);
        return;
      }
      setHours(data.hours);
    } finally {
      setLoading(false);
    }
  }, [dryDockProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <ActiniumLoadingState label="Loading machinery hours…" size="sm" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!hours) return null;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Main engine</CardTitle>
          {hours.mainEngine ? (
            <CardDescription>{hours.mainEngine}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {formatHours(hours.mainEngineRunningHours)}
          </p>
          <p className="text-xs text-muted-foreground">Running hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auxiliary engine</CardTitle>
          {hours.auxiliaryEngine ? (
            <CardDescription>{hours.auxiliaryEngine}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {formatHours(hours.auxiliaryEngineRunningHours)}
          </p>
          <p className="text-xs text-muted-foreground">Running hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boiler</CardTitle>
          {hours.boilerInfo ? <CardDescription>{hours.boilerInfo}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">
            {formatHours(hours.boilerRunningHours)}
          </p>
          <p className="text-xs text-muted-foreground">Running hours</p>
        </CardContent>
      </Card>

      {hours.updatedAt ? (
        <p className="text-xs text-muted-foreground md:col-span-3">
          Last updated {new Date(hours.updatedAt).toLocaleString()}
          {hours.updatedBy ? ` by ${hours.updatedBy}` : ""}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground md:col-span-3">
          No running hours recorded yet. Ship staff update these from Ship Access → Machinery hours.
        </p>
      )}
    </div>
  );
}
