"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

const ViewRequisitionsContent = dynamic(
  () =>
    import("./ViewRequisitionsContent").then((mod) => mod.ViewRequisitionsContent),
  {
    ssr: false,
    loading: () => <PageReadyGate ready={false} loadingText="Loading requisitions…" />,
  }
);

export default function ViewRequisitionsPage() {
  return (
    <Suspense fallback={<PageReadyGate ready={false} loadingText="Loading requisitions…" />}>
      <ViewRequisitionsContent />
    </Suspense>
  );
}
