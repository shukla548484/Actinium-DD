import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PlatformOperatorPage() {
  const pathname = (await headers()).get("x-pathname") ?? "/platform/operator";
  await enforceOfficePageAccess(pathname);

  return (
    <PageShell>
      <PageHeader
        title="Operations console"
        description="Sync queues, import jobs, and batch operations for SYS_OPERATOR."
      />
      <p className="text-sm text-muted-foreground">
        Queue monitor UI will connect to sync and import pipelines here.
      </p>
    </PageShell>
  );
}
