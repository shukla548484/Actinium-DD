import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { WorkshopJobBoard } from "@/components/shipyard/WorkshopJobBoard";
import { listYardWorkProjects, listWorkshopJobs } from "@/lib/db/yardExecution";

export const dynamic = "force-dynamic";

export default async function MasterSchedulePage() {
  const yardProjects = await listYardWorkProjects();
  const active = yardProjects[0];
  const jobs = active ? await listWorkshopJobs(active.id) : [];

  return (
    <PageShell size="wide">
      <PageHeader
        title="Master schedule"
        description="Cross-workshop timeline — planned start/finish, critical path, and resource conflicts."
      />
      <WorkshopJobBoard jobs={jobs} />
    </PageShell>
  );
}
