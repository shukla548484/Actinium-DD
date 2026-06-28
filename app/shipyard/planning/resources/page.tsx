import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function ResourcesPlanningPage() {
  return (
    <PageShell>
      <PageHeader
        title="Resource planning"
        description="Manpower, equipment, and material allocation across workshops and the master timeline."
      />
      <p className="text-sm text-muted-foreground">
        Links to manpower, equipment, and material planning screens under Execution and Planning.
      </p>
    </PageShell>
  );
}
