import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { WorkshopJobBoardInteractive } from "@/components/shipyard/WorkshopJobBoardInteractive";
import { listYardWorkProjects, listWorkshopJobs } from "@/lib/db/yardExecution";
import { getWorkshopBySlug } from "@/lib/shipyard/workshops";

export const dynamic = "force-dynamic";

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workshop = getWorkshopBySlug(slug);
  if (!workshop) notFound();

  const yardProjects = await listYardWorkProjects();
  const active = yardProjects[0];
  const jobs = active
    ? await listWorkshopJobs(active.id, slug)
    : [];

  return (
    <PageShell size="wide">
      <PageHeader
        title={workshop.name}
        description={`${workshop.typicalScope}${active ? ` · ${active.project.name}` : ""}`}
      />
      <WorkshopJobBoardInteractive jobs={jobs} showWorkshop={false} />
    </PageShell>
  );
}
