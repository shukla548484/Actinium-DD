"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const DraftRequisitionsContent = dynamic(
  () =>
    import("./DraftRequisitionsContent").then((mod) => ({
      default: mod.DraftRequisitionsContent,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading draft requisitions…" showDots />
      </div>
    ),
  }
);

export default function DraftRequisitionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading draft requisitions…" showDots />
        </div>
      }
    >
      <DraftRequisitionsContent />
    </Suspense>
  );
}
