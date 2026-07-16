"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import ActiniumLoader from "@/components/ActiniumLoader";

const InventoryManagementContent = dynamic(
  () =>
    import("./InventoryManagementContent").then((mod) => mod.InventoryManagementContent),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
        <ActiniumLoader size="lg" text="Loading inventory…" showDots />
      </div>
    ),
  }
);

export default function InventoryManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-16">
          <ActiniumLoader size="lg" text="Loading inventory…" showDots />
        </div>
      }
    >
      <InventoryManagementContent />
    </Suspense>
  );
}
