import { Suspense } from "react";
import { PageAccessMatrix } from "@/components/admin/PageAccessMatrix";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

export default function AdminAccessPage() {
  return (
    <PageShell size="wide">
      <PageHeader
        title="Page access"
        description="Control which pages and modules are available to each role. Changes apply to all users with that role."
      />
      <Suspense fallback={<ActiniumLoadingState size="sm" />}>
        <PageAccessMatrix />
      </Suspense>
    </PageShell>
  );
}
