import { Suspense } from "react";
import DryDockNewJobPageClient from "./DryDockNewJobPageClient";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export default function DryDockNewJobPage() {
  return (
    <Suspense fallback={<ActiniumLoadingState size="md" minHeight={140} />}>
      <DryDockNewJobPageClient />
    </Suspense>
  );
}
