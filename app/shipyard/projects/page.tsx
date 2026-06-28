import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ShipyardProjectList } from "@/components/shipyard/ShipyardProjectList";
import { listProjects } from "@/lib/db/index";
import { listYardWorkProjects } from "@/lib/db/yardExecution";

export const dynamic = "force-dynamic";

export default async function ShipyardProjectsPage() {
  const [yardProjects, fleetProjects] = await Promise.all([
    listYardWorkProjects(),
    listProjects(),
  ]);

  const yardByProjectId = new Map(yardProjects.map((y) => [y.projectId, y]));

  const rows = fleetProjects
    .filter((p) => p.status !== "draft")
    .map((p) => {
      const ywp = yardByProjectId.get(p.id);
      const jobs = ywp?.jobs ?? [];
      return {
        id: ywp?.id ?? p.id,
        projectId: p.id,
        status: ywp?.status ?? "planning",
        projectName: p.name,
        vesselName: p.vesselName,
        jobCount: jobs.length,
        completedJobs: jobs.filter((j) => j.status === "completed").length,
      };
    });

  return (
    <PageShell size="wide">
      <PageHeader
        title="Active projects"
        description="Dry-dock execution projects — workshop job allocation, progress, and dependencies. Superintendent scope is read from the linked tender project."
      />
      <ShipyardProjectList rows={rows} />
    </PageShell>
  );
}
