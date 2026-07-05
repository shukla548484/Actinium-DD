import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ExternalQuotesPanel } from "@/components/external/ExternalPortalPanels";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ExternalQuotesPage() {
  const pathname = (await headers()).get("x-pathname") ?? "/external/quotes";
  await enforceOfficePageAccess(pathname);

  return (
    <PageShell>
      <PageHeader
        title="My quotes"
        description="Quotes you have submitted or are preparing for office review."
      />
      <ExternalQuotesPanel />
    </PageShell>
  );
}
