import Link from "next/link";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardKpiGrid } from "@/components/shipyard/ShipyardKpiGrid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getShipyardDashboardKpis, listYardWorkProjects } from "@/lib/db/yardExecution";
import { DEPENDENCY_CHAIN_TEMPLATE, WORKSHOPS } from "@/lib/shipyard/workshops";

export const dynamic = "force-dynamic";

export default async function ShipyardDashboardPage() {
  const [kpis, projects] = await Promise.all([
    getShipyardDashboardKpis(),
    listYardWorkProjects(),
  ]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Shipyard dashboard"
        description="Execution-side view — workshop planning, daily progress, dependencies, and commercial close-out. Separate from superintendent tender management."
        actions={
          <Button render={<Link href="/shipyard/projects" />} nativeButton={false}>
            Active projects
          </Button>
        }
      />

      <ShipyardKpiGrid kpis={kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workshop teams</CardTitle>
            <CardDescription>
              {WORKSHOPS.length} workshops — each with its own job board and planning screen.
            </CardDescription>
          </CardHeader>
          <ul className="grid gap-2 px-6 pb-6 sm:grid-cols-2">
            {WORKSHOPS.slice(0, 8).map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/shipyard/workshops/${w.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  {w.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical path template</CardTitle>
            <CardDescription>Standard dependency chain affecting undocking date.</CardDescription>
          </CardHeader>
          <ol className="space-y-1 px-6 pb-6 text-sm">
            {DEPENDENCY_CHAIN_TEMPLATE.map((step) => (
              <li key={step.jobTitle} className="text-muted-foreground">
                {step.jobTitle}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent execution projects</CardTitle>
          <CardDescription>{projects.length} project(s) with yard work tracking</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Open a superintendent project and map scope to workshops to begin execution planning.
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{p.project.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/shipyard/projects/${p.projectId}`} />}
                    nativeButton={false}
                  >
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
