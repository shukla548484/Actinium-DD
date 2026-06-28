"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  extractPaintingAreas,
  hullCompareHint,
  paintingAreasToHullZones,
  paintingAreasTotal,
} from "@/lib/superintendent/paintingInputSummary";

type Props = {
  values: Record<string, unknown>;
  dryDockProjectId: string;
};

export function PaintingAreasPanel({ values, dryDockProjectId }: Props) {
  const areas = useMemo(() => extractPaintingAreas(values), [values]);
  const zones = useMemo(() => paintingAreasToHullZones(areas), [areas]);
  const total = useMemo(() => paintingAreasTotal(areas), [areas]);
  const hint = useMemo(() => hullCompareHint(areas), [areas]);

  if (zones.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Hull paint zones</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((z) => (
            <div key={z.zone} className="rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{z.zone}</p>
              <p className="tabular-nums text-muted-foreground">{z.areaM2.toLocaleString()} m²</p>
            </div>
          ))}
        </div>
        {total != null ? (
          <p className="text-sm font-medium tabular-nums">Total: {total.toLocaleString()} m²</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/compare?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`} />}
            nativeButton={false}
          >
            Open hull paint compare
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/superintendent/projects/${dryDockProjectId}/comparison`}
              />
            }
            nativeButton={false}
          >
            Budget vs quote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
