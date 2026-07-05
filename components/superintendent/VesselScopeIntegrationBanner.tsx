"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type ScopeStats = {
  integratedTotal: number;
  autoImportedAtProvision: number;
  pendingInBank: number;
  integratedFromDefects: number;
  integratedFromPms: number;
};

type Props = {
  dryDockProjectId: string;
};

export function VesselScopeIntegrationBanner({ dryDockProjectId }: Props) {
  const [stats, setStats] = useState<ScopeStats | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${dryDockProjectId}/vessel-scope-stats`)
      .then((r) => r.json())
      .then((d: { stats?: ScopeStats }) => setStats(d.stats ?? null));
  }, [dryDockProjectId]);

  if (!stats) return null;
  if (stats.integratedTotal === 0 && stats.pendingInBank === 0) return null;

  return (
    <Card className="mb-4 border-primary/20 bg-primary/5">
      <CardContent className="py-3 text-sm">
        <span className="font-medium">{stats.integratedTotal}</span> vessel job
        {stats.integratedTotal === 1 ? "" : "s"} integrated into scope
        {stats.autoImportedAtProvision > 0 ? (
          <> ({stats.autoImportedAtProvision} auto-imported at project creation)</>
        ) : null}
        .{" "}
        {stats.integratedFromDefects > 0 ? (
          <>{stats.integratedFromDefects} from linked defects · </>
        ) : null}
        {stats.integratedFromPms > 0 ? (
          <>{stats.integratedFromPms} from PMS · </>
        ) : null}
        {stats.pendingInBank > 0 ? (
          <>
            <span className="font-medium">{stats.pendingInBank}</span> awaiting integration in the{" "}
            <Link
              href={`/superintendent/projects/${dryDockProjectId}/inputs/vessel/jobs`}
              className="underline"
            >
              vessel job bank
            </Link>
            .
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
