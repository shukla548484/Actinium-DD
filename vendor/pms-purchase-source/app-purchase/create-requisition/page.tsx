"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const CreateRequisitionContent = dynamic(
  () =>
    import("./CreateRequisitionContent").then((mod) => ({
      default: mod.CreateRequisitionContent,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading requisition form…" showDots />
      </div>
    ),
  }
);

export default function CreateRequisitionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading requisition form…" showDots />
        </div>
      }
    >
      <CreateRequisitionContent />
    </Suspense>
  );
}
