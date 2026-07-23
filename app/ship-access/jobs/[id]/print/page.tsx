import { notFound } from "next/navigation";
import { VesselJobPrintDocument } from "@/components/shipAccess/VesselJobPrintDocument";
import { enforceCrewPageAccess } from "@/lib/auth/shipAccess";
import { getDdVesselJobPrintBundle } from "@/lib/db/superintendent/vesselJobs";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShipAccessJobPrintPage({ params }: PageProps) {
  await enforceCrewPageAccess("/ship-access/jobs");

  const { id } = await params;
  const existing = await getDdVesselJobPrintBundle(id);
  if (!existing) notFound();

  const access = await assertShipVesselInScope(existing.vessel.id);
  if (!access.ok) notFound();

  return <VesselJobPrintDocument bundle={existing} />;
}
