"use client";

import { useParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { InputReviewQueue } from "@/components/superintendent/InputReviewQueue";

export default function InputReviewPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PageShell size="wide">
      <PageHeader
        title="Input review"
        description="Review and approve vessel pre-docking submissions."
      />
      <InputReviewQueue dryDockProjectId={id} />
    </PageShell>
  );
}
