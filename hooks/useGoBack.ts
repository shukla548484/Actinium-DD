"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getParentPath, resolveBackFallback } from "@/lib/navigation/goBack";

/**
 * Navigate to the previous history entry so list filters / form state are preserved.
 * Falls back to the parent path (or explicit href) when there is no history.
 */
export function useGoBack(fallbackHref?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const fallback = resolveBackFallback(pathname, fallbackHref ?? getParentPath(pathname));

  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }, [router, fallback]);
}
