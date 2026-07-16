"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const DNStatusContent = dynamic(
  () => import("./DNStatusContent").then((m) => ({ default: m.DNStatusContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading DN status…" showDots />
      </div>
    ),
  }
);

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading DN status…" showDots />
        </div>
      }
    >
      <DNStatusContent />
    </Suspense>
  );
}
