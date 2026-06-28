import { notFound } from "next/navigation";
import { ProjectDashboard } from "@/components/portal/ProjectDashboard";
import { PageShell } from "@/components/layout/PageShell";
import { getProjectDetail } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectDetail(id);
  if (!project) notFound();

  return (
    <PageShell>
      <ProjectDashboard project={project} />
    </PageShell>
  );
}
