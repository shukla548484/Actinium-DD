import { YardInvitesFleetPanel } from "@/components/shipyard/YardInvitesFleetPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { listAllYardInvites } from "@/lib/db/index";

export const dynamic = "force-dynamic";

export default async function TenderInvitesPage() {
  const invites = await listAllYardInvites();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Yard invites"
        description="RFQ invitations across dry-dock jobs — portal links and submission status (pre-award tender workflow)."
      />
      <YardInvitesFleetPanel initialInvites={invites} />
    </PageShell>
  );
}
