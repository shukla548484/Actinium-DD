import { notFound } from "next/navigation";
import { VesselForm } from "@/components/admin/VesselForm";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { listCompaniesForSelect } from "@/lib/db/companies";
import { getVessel } from "@/lib/db/vessels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditVesselPage({ params }: Props) {
  const { id } = await params;
  const [vessel, companies] = await Promise.all([
    getVessel(id),
    listCompaniesForSelect(false),
  ]);
  if (!vessel) notFound();

  return (
    <PageShell>
      <PageHeader title={`Edit ${vessel.name}`} description={`Vessel code ${vessel.code}`} />
      <VesselForm
        mode="edit"
        vesselId={id}
        initial={vessel}
        initialCompanies={companies.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }))}
      />
    </PageShell>
  );
}
