import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { enforceOfficePageAccess } from "@/lib/auth/officePageAccess";
import { headers } from "next/headers";

type Props = { title: string; description: string; children?: React.ReactNode };

export async function ExternalPortalPage({ title, description, children }: Props) {
  const pathname = (await headers()).get("x-pathname") ?? "/external";
  await enforceOfficePageAccess(pathname);

  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      {children ?? (
        <p className="text-sm text-muted-foreground">
          External party portal scaffold — project read access and submissions coming next.
        </p>
      )}
    </PageShell>
  );
}
