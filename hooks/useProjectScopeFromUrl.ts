"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";

/** Read dryDockProjectId from the current URL query string. */
export function useProjectScopeFromUrl(): string | undefined {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const id = searchParams.get("dryDockProjectId")?.trim();
    return id || undefined;
  }, [searchParams]);
}

/**
 * Resolved project scope: URL query wins, then session active project cookie.
 * Returns undefined when neither is set (fleet-wide).
 */
export function useResolvedProjectScope(): string | undefined {
  const fromUrl = useProjectScopeFromUrl();
  const { activeProjectId } = useActiveDryDockProject();
  return fromUrl ?? activeProjectId ?? undefined;
}

/** Initial project filter: URL / active project wins, otherwise "all". */
export function useInitialProjectFilter(): string {
  const scoped = useResolvedProjectScope();
  return scoped ?? "all";
}
