"use client";

import Link from "next/link";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ShipAccessOverviewPage() {
  const ctx = useShipAccessContext();

  return (
    <PageShell>
      <PageHeader
        title="Ship Access"
        description="Onboard portal for proposing dry dock scope jobs to the superintendent job bank."
      />

      {ctx.error ? <p className="text-sm text-destructive">{ctx.error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your vessel</CardTitle>
            <CardDescription>Jobs are scoped to the selected vessel.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {ctx.loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : ctx.vessel ? (
              <p className="font-medium">
                {ctx.vessel.name} <span className="text-muted-foreground">({ctx.vessel.code})</span>
              </p>
            ) : (
              <p className="text-muted-foreground">
                No vessel is assigned to your account. Contact the office to link your employee profile
                to a vessel.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active dry dock project</CardTitle>
            <CardDescription>Proposed jobs are linked to this project when available.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {ctx.loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : ctx.dryDockProject ? (
              <div className="space-y-1">
                <p className="font-medium">{ctx.dryDockProject.name}</p>
                {ctx.dryDockProject.referenceCode ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    {ctx.dryDockProject.referenceCode}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">No open dry dock project for this vessel yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create scope jobs</CardTitle>
          <CardDescription>
            Submit jobs to the vessel job bank. The technical superintendent reviews and integrates
            approved items into the dry dock scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/ship-access/jobs/new" />}
            nativeButton={false}
            disabled={!ctx.vesselId}
          >
            Create job
          </Button>
          <Button
            variant="outline"
            render={<Link href="/ship-access/jobs" />}
            nativeButton={false}
            disabled={!ctx.vesselId}
          >
            View my submissions
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
