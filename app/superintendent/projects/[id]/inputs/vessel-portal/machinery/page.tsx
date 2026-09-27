"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { MachineryRegisterPanel } from "@/components/machinery/MachineryRegisterPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VesselPortalMachineryPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery technical data"
        description="Register, running hours, parameters, and condition reports feed dry dock scope."
      />
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Machinery register</h2>
        <MachineryRegisterPanel side="office" dryDockProjectId={id} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Machinery dashboard</CardTitle>
            <CardDescription>
              Health score, overdue PMS, and upcoming overhauls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/ship-access/machinery" />} nativeButton={false}>
              Open machinery dashboard
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Running hours (legacy)</CardTitle>
            <CardDescription>Single-form ME / AE / boiler hours entry.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              render={<Link href="/ship-access/machinery-hours" />}
              nativeButton={false}
            >
              Legacy machinery hours
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PMS schedule</CardTitle>
            <CardDescription>Overdue maintenance and linked dry dock jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/ship-access/pms" />} nativeButton={false}>
              Open PMS schedule
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ship register</CardTitle>
            <CardDescription>Same register in the onboard Ship Access portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              render={<Link href="/ship-access/machinery/register" />}
              nativeButton={false}
            >
              Open ship machinery register
            </Button>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Superintendent view:{" "}
        <Link
          href={`/superintendent/projects/${id}/inputs/vessel/machinery`}
          className="underline"
        >
          project machinery summary
        </Link>
      </p>
    </PageShell>
  );
}
