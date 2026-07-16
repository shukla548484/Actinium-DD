"use client";

import ActiniumLoader from "@/components/ActiniumLoader";

/**
 * Route-segment loading UI — Actinium brand loader while Next.js streams the page.
 */
export function PageContentSkeleton() {
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center p-6"
      data-testid="page-content-skeleton"
    >
      <ActiniumLoader size="lg" text="Loading…" showDots />
    </div>
  );
}

export default PageContentSkeleton;
