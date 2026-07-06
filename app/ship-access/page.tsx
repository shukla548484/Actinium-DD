"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function ShipAccessOverviewPage() {
  const ctx = useShipAccessContext();
  const [assignedPageKeys, setAssignedPageKeys] = useState<string[] | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as
          | { isVesselCrew?: boolean; assignedPageKeys?: string[] }
          | undefined;
        if (user?.isVesselCrew) {
          setAssignedPageKeys(user.assignedPageKeys ?? []);
        } else {
          setAssignedPageKeys(null);
        }
      })
      .catch(() => setAssignedPageKeys(null));
  }, []);

  const has = (key: string) => assignedPageKeys == null || assignedPageKeys.includes(key);

  return (
    <PageShell>
      <PageHeader
        title="Ship Access"
        description="Onboard portal for machinery, defects, dry dock jobs, and purchase requisitions."
      />

      {ctx.error ? <p className="text-sm text-destructive">{ctx.error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your vessel</CardTitle>
            <CardDescription>All modules are scoped to the selected vessel.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {ctx.loading ? (
              <ActiniumLoadingState size="sm" />
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
            <CardDescription>Jobs and requisitions link to this project when available.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {ctx.loading ? (
              <ActiniumLoadingState size="sm" />
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

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {has("page.shipAccess.machineryDashboard") || has("page.shipAccess.machineryHours") ? (
          <Card>
            <CardHeader>
              <CardTitle>Machinery</CardTitle>
              <CardDescription>
                Health score, running hours, parameters, and condition reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {has("page.shipAccess.machineryDashboard") ? (
                <Button
                  render={<Link href="/ship-access/machinery" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Machinery dashboard
                </Button>
              ) : null}
              {has("page.shipAccess.machineryRunningHours") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/machinery/running-hours" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Running hours
                </Button>
              ) : null}
              {has("page.shipAccess.machineryHours") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/machinery-hours" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Legacy hours
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {has("page.shipAccess.dryDockDashboard") || has("page.shipAccess.dryDockJobs.new") ? (
          <Card>
            <CardHeader>
              <CardTitle>Dry dock scope</CardTitle>
              <CardDescription>
                Build scope from the master job library — feeds the superintendent project template.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {has("page.shipAccess.dryDockDashboard") ? (
                <Button
                  render={<Link href="/ship-access/dry-dock" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Preparation dashboard
                </Button>
              ) : null}
              {has("page.shipAccess.dryDockJobs.new") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/dry-dock/jobs/new" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Add job from library
                </Button>
              ) : null}
              {has("page.shipAccess.dryDockJobs") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/dry-dock/jobs" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  View scope jobs
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {has("page.shipAccess.machineryHours") && !has("page.shipAccess.machineryDashboard") && (
          <Card>
            <CardHeader>
              <CardTitle>Machinery</CardTitle>
              <CardDescription>Update main engine, auxiliary, and boiler running hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                render={<Link href="/ship-access/machinery-hours" />}
                nativeButton={false}
                disabled={!ctx.vesselId}
              >
                Machinery hours
              </Button>
            </CardContent>
          </Card>
        )}

        {(has("page.shipAccess.defects") || has("page.shipAccess.defects.new")) && (
          <Card>
            <CardHeader>
              <CardTitle>Defects</CardTitle>
              <CardDescription>
                Report equipment defects for Master approval before office requisitions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {has("page.shipAccess.defects.new") ? (
                <Button
                  render={<Link href="/ship-access/defects/new" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Report defect
                </Button>
              ) : null}
              {has("page.shipAccess.defects") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/defects" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  View defects
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        {(has("page.shipAccess.jobs") || has("page.shipAccess.jobs.new")) && (
          <Card>
            <CardHeader>
              <CardTitle>Dry dock jobs</CardTitle>
              <CardDescription>
                Propose scope jobs for superintendent review and integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {has("page.shipAccess.jobs.new") ? (
                <Button
                  render={<Link href="/ship-access/jobs/new" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  Create job
                </Button>
              ) : null}
              {has("page.shipAccess.jobs") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/jobs" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  View jobs
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}

        {has("page.shipAccess.purchase") && (
          <Card>
            <CardHeader>
              <CardTitle>Purchase</CardTitle>
              <CardDescription>
                Raise spares requisitions from Master-approved defects.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {has("page.shipAccess.purchase.new") ? (
                <Button
                  render={<Link href="/ship-access/purchase/new" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  New requisition
                </Button>
              ) : null}
              {has("page.shipAccess.purchase") ? (
                <Button
                  variant="outline"
                  render={<Link href="/ship-access/purchase" />}
                  nativeButton={false}
                  disabled={!ctx.vesselId}
                >
                  View requisitions
                </Button>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
