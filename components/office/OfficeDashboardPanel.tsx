"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Metric = { label: string; value: number | string };

type Props = {
  apiPath: string;
  mapStats: (data: Record<string, unknown>) => Metric[];
};

export function OfficeDashboardPanel({ apiPath, mapStats }: Props) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiPath);
        const data = (await res.json()) as Record<string, unknown> & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Failed to load dashboard");
          return;
        }
        if (!cancelled) setMetrics(mapStats(data));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiPath, mapStats]);

  if (loading) {
    return <ActiniumLoadingState label="Loading dashboard…" size="md" minHeight={120} />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
            <p className="text-sm text-muted-foreground">{m.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
