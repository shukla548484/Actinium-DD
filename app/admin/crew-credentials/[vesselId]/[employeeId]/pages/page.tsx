import Link from "next/link";
import { notFound } from "next/navigation";
import { CrewPageAccessPanel } from "@/components/admin/CrewPageAccessPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getCrewPageAccessDetail } from "@/lib/db/crewPageAccess";
import { getVessel } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ vesselId: string; employeeId: string }> };

export default async function CrewPageAccessPage({ params }: Props) {
  const { vesselId, employeeId } = await params;
  const [vessel, detail] = await Promise.all([
    getVessel(vesselId),
    getCrewPageAccessDetail(vesselId, employeeId),
  ]);
  if (!vessel || !detail) notFound();

  return (
    <PageShell>
      <PageHeader
        title="Assign onboard pages"
        description={`${detail.employeeName} · ${vessel.name} (${vessel.code})`}
        actions={
          <Button
            variant="outline"
            render={<Link href={`/admin/crew-credentials/${vesselId}`} />}
            nativeButton={false}
          >
            Back to vessel
          </Button>
        }
      />
      <CrewPageAccessPanel
        vesselId={vesselId}
        employeeId={employeeId}
        backHref={`/admin/crew-credentials/${vesselId}`}
      />
    </PageShell>
  );
}
