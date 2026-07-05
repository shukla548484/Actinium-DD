import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { AuditLogPanel } from "@/components/platform/AuditLogPanel";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PlatformMonitorPage() {
  const pathname = (await headers()).get("x-pathname") ?? "/platform/monitor";
  await enforceOfficePageAccess(pathname);

  return (
    <PageShell>
      <PageHeader
        title="Infrastructure monitor"
        description="Alerts, audit trail, and system health for SYS_MONITOR."
      />
      <AuditLogPanel />
    </PageShell>
  );
}
