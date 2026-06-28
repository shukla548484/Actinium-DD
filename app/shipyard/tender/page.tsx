import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TenderOverviewPage() {
  return (
    <PageShell>
      <PageHeader
        title="Tender & RFQ"
        description="Pre-award quoting workflow — separate from post-award workshop execution. Yards submit rates via token portal."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yard invites</CardTitle>
            <CardDescription>Send RFQ links and track yard quote submissions.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/shipyard/tender/invites" />}
              nativeButton={false}
            >
              Open invites →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipyard directory</CardTitle>
            <CardDescription>Registered shipyard companies for invitations.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/shipyard/yards" />}
              nativeButton={false}
            >
              View directory →
            </Button>
          </CardHeader>
        </Card>
      </div>
    </PageShell>
  );
}
