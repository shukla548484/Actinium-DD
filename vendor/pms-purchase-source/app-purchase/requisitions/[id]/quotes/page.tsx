"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const QuotesContent = dynamic(
  () =>
    import("./QuotesContent").then((mod) => ({
      default: mod.QuotesContent,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading quotes…" showDots />
      </div>
    ),
  }
);

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading quotes…" showDots />
        </div>
      }
    >
      <QuotesContent />
    </Suspense>
  );
}
