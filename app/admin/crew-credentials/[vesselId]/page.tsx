import Link from "next/link";
import { notFound } from "next/navigation";
import { CrewCredentialPanel } from "@/components/admin/CrewCredentialPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getVessel } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ vesselId: string }> };

export default async function VesselCrewCredentialsPage({ params }: Props) {
  const { vesselId } = await params;
  const vessel = await getVessel(vesselId);
  if (!vessel) notFound();

  return (
    <PageShell>
      <PageHeader
        title="Crew credentials"
        description={`${vessel.name} · ${vessel.code} · ${vessel.company?.name ?? vessel.companyName}. Create credentials, then use Pages to control onboard access.`}
        actions={
          <Button
            variant="outline"
            render={<Link href="/admin/crew-credentials" />}
            nativeButton={false}
          >
            Change vessel
          </Button>
        }
      />
      <CrewCredentialPanel vesselId={vesselId} />
    </PageShell>
  );
}
