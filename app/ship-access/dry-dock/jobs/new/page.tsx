import { Suspense } from "react";
import DryDockNewJobPageClient from "./DryDockNewJobPageClient";

export default function DryDockNewJobPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <DryDockNewJobPageClient />
    </Suspense>
  );
}
