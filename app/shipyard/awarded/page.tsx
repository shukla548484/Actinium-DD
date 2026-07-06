import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listYardWorkProjects } from "@/lib/db/yardExecution";
import { listShipyardRfqQueue } from "@/lib/db/shipyardRfq";

export const dynamic = "force-dynamic";

export default async function AwardedProjectsPage() {
  const [awarded, projects] = await Promise.all([
    listShipyardRfqQueue().then((rows) => rows.filter((r) => r.workflowStage === "award_received")),
    listYardWorkProjects(),
  ]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Awarded projects"
        description="Contracts won after quotation — hand off to project planning and workshop execution."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accepted RFQs</CardTitle>
            <CardDescription>{awarded.length} award(s) from comparison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {awarded.length === 0 ? (
              <p className="text-muted-foreground">No accepted yard invites yet.</p>
            ) : (
              awarded.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="font-medium">{row.projectName}</p>
                    <p className="text-xs text-muted-foreground">{row.rfqReference}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/shipyard/projects/${row.projectId}`} />}
                    nativeButton={false}
                  >
                    Open
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution projects</CardTitle>
            <CardDescription>{projects.length} yard work project(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {projects.length === 0 ? (
              <p className="text-muted-foreground">Initialize execution from an awarded project.</p>
            ) : (
              projects.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span>{p.project.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/shipyard/projects/${p.projectId}`} />}
                    nativeButton={false}
                  >
                    Open
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
