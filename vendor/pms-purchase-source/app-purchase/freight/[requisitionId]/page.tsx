"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const FreightWorkspaceContent = dynamic(
  () => import("./FreightWorkspaceContent").then((m) => ({ default: m.FreightWorkspaceContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading freight workspace…" showDots />
      </div>
    ),
  }
);

export default function FreightWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading freight workspace…" showDots />
        </div>
      }
    >
      <FreightWorkspaceContent />
    </Suspense>
  );
}
