import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { WorkshopJobBoard } from "@/components/shipyard/WorkshopJobBoard";
import { listYardWorkProjects, listWorkshopJobs } from "@/lib/db/yardExecution";

export const dynamic = "force-dynamic";

export default async function JobBoardPage() {
  const yardProjects = await listYardWorkProjects();
  const active = yardProjects[0];
  const jobs = active ? await listWorkshopJobs(active.id) : [];

  return (
    <PageShell size="wide">
      <PageHeader
        title="Job board"
        description="All workshop jobs across the active project — filter by workshop, priority, and blocking status."
      />
      <WorkshopJobBoard jobs={jobs} />
    </PageShell>
  );
}
