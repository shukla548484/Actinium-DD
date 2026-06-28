import { PageHeader, PageShell } from "@/components/layout/PageShell";

export default function ShipyardMilestonesPage() {
  return (
    <PageShell>
      <PageHeader
        title="Project milestones"
        description="Docking, undocking, class hold points, and owner approval gates across active yard projects."
      />
      <p className="text-sm text-muted-foreground">
        Milestone tracking links to workshop jobs marked as class hold points or owner approval required.
      </p>
    </PageShell>
  );
}
