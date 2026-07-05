"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VesselPortalDefectsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell>
      <PageHeader
        title="Defects"
        description="Report equipment defects for Master approval before office requisitions."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report defect</CardTitle>
            <CardDescription>Log machinery and equipment abnormalities.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href="/ship-access/defects/new" />} nativeButton={false}>
              New defect
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">View defects</CardTitle>
            <CardDescription>Track draft, submitted, and approved defects.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href="/ship-access/defects" />}
              nativeButton={false}
            >
              All defects
            </Button>
            <Button
              variant="outline"
              render={<Link href="/ship-access/defects?status=submitted" />}
              nativeButton={false}
            >
              Master review
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
