import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

type Props = { title: string; description: string };

async function PlatformModulePage({ title, description }: Props) {
  const pathname = (await headers()).get("x-pathname") ?? "/platform";
  await enforceOfficePageAccess(pathname);

  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      <p className="text-sm text-muted-foreground">
        Platform operations scaffold — wire health checks and job queues here.
      </p>
    </PageShell>
  );
}

export const dynamic = "force-dynamic";

export default function PlatformAdminPage() {
  return (
    <PlatformModulePage
      title="Platform admin"
      description="Tenant licensing, security, and system configuration for SYS_ADMIN."
    />
  );
}
