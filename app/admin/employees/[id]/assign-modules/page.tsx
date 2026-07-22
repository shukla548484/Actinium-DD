import { AssignModulesPanel } from "@/components/admin/AssignModulesPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AssignModulesPage({ params }: Props) {
  const { id } = await params;

  return (
    <PageShell size="wide">
      <PageHeader
        title="Assign modules"
        description="Grant portal modules first, then choose which pages inside each module this employee may open."
      />
      <AssignModulesPanel employeeId={id} />
    </PageShell>
  );
}
