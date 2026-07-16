/** Allow in-app relative paths only (no open redirects). */
export function isSafeReturnTo(path: string | null | undefined): path is string {
  if (!path?.trim()) return false;
  const p = path.trim();
  return p.startsWith("/") && !p.startsWith("//");
}

export function navigateWithReturnTo(
  router: { push: (href: string) => void; back: () => void },
  returnTo: string | null | undefined,
  fallbackPath = "/purchase/view-requisitions"
) {
  if (isSafeReturnTo(returnTo)) {
    router.push(returnTo);
    return;
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push(fallbackPath);
}
