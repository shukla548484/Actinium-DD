"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/** Read dryDockProjectId from the current URL query string. */
export function useProjectScopeFromUrl(): string | undefined {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const id = searchParams.get("dryDockProjectId")?.trim();
    return id || undefined;
  }, [searchParams]);
}

/** Initial project filter: URL scope wins, otherwise "all". */
export function useInitialProjectFilter(): string {
  const scoped = useProjectScopeFromUrl();
  return scoped ?? "all";
}
