"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VesselPortalRequisitionsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell>
      <PageHeader
        title="Purchase requisitions"
        description="Raise spares requisitions from Master-approved defects."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create requisition</CardTitle>
            <CardDescription>Link spares lines to an approved defect.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/ship-access/purchase/new" />} nativeButton={false}>
              New requisition
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">View requisitions</CardTitle>
            <CardDescription>Track draft, submitted, and Master-approved requisitions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href="/ship-access/purchase" />}
              nativeButton={false}
            >
              All requisitions
            </Button>
            <Button
              variant="outline"
              render={<Link href="/ship-access/purchase?status=submitted" />}
              nativeButton={false}
            >
              Master review
            </Button>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Master-approved requisitions can be converted to project spares by the superintendent from{" "}
        <Link
          href={`/superintendent/projects/${id}/inputs/vessel/requisitions`}
          className="underline"
        >
          Vessel → Requisitions
        </Link>
        .
      </p>
    </PageShell>
  );
}
