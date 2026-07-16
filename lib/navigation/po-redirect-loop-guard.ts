const PREFIX = "po-nav-bounce:";

/** Record a cross-page redirect attempt; returns true if a loop is detected. */
export function recordPoNavBounce(quoteId: string): boolean {
  if (typeof sessionStorage === "undefined" || !quoteId) return false;
  const key = `${PREFIX}${quoteId}`;
  const count = Number(sessionStorage.getItem(key) || 0) + 1;
  sessionStorage.setItem(key, String(count));
  return count >= 2;
}

export function clearPoNavBounce(quoteId: string): void {
  if (typeof sessionStorage === "undefined" || !quoteId) return;
  sessionStorage.removeItem(`${PREFIX}${quoteId}`);
}
