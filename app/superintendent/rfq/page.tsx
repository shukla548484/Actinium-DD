import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function RfqPage() {
  return (
    <PageShell>
      <PageHeader
        title="Tender & RFQ"
        description="Linked tender projects and yard quote comparison."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tender projects</CardTitle>
            <CardDescription>
              Create and manage dry-dock tender specs, invite yards, and collect quotes.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/projects" />}
              nativeButton={false}
            >
              Open tender projects →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New tender</CardTitle>
            <CardDescription>Start a new dry-dock tender for yard bidding.</CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/projects/new" />}
              nativeButton={false}
            >
              Create tender →
            </Button>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dry dock projects</CardTitle>
            <CardDescription>
              Link awarded tenders to execution projects in your superintendent scope.
            </CardDescription>
            <Button
              variant="link"
              className="h-auto w-fit p-0"
              render={<Link href="/superintendent/projects" />}
              nativeButton={false}
            >
              Open dry dock projects →
            </Button>
          </CardHeader>
        </Card>
      </div>
    </PageShell>
  );
}
