import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { DependencyEditor } from "@/components/shipyard/DependencyEditor";
import { getYardWorkProjectByProjectId } from "@/lib/db/yardExecution";
import { loadShipyardRegisterPageData } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default async function DependenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const { projectId } = await loadShipyardRegisterPageData(project);
  const { jobs } = projectId
    ? await getYardWorkProjectByProjectId(projectId)
    : { jobs: [] as Awaited<ReturnType<typeof getYardWorkProjectByProjectId>>["jobs"] };

  return (
    <PageShell size="wide">
      <PageHeader
        title="Dependencies"
        description="Map blocking relationships between workshop jobs — delays here affect undocking."
      />
      {projectId && jobs.length > 0 ? (
        <DependencyEditor projectId={projectId} jobs={jobs} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Open a project and map scope to workshops before editing dependencies.
        </p>
      )}
    </PageShell>
  );
}
