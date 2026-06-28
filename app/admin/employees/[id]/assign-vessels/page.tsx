import { AssignVesselsPanel } from "@/components/admin/AssignVesselsPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AssignVesselsPage({ params }: Props) {
  const { id } = await params;

  return (
    <PageShell size="wide">
      <PageHeader
        title="Assign vessels"
        description="Link this employee to one or more vessels in their company hierarchy."
      />
      <AssignVesselsPanel employeeId={id} />
    </PageShell>
  );
}
