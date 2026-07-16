/** True for dev-server restarts, offline, and other transient network failures. */
export function isTransientFetchError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof TypeError) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed")
  );
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchWithRetryOptions = RequestInit & {
  /** Extra attempts after the first try (default 2 → 3 total). */
  retries?: number;
  /** Base delay in ms; multiplied by attempt index (default 1000). */
  delayMs?: number;
};

/**
 * fetch with retry/backoff on transient network errors and 5xx responses.
 * Re-throws AbortError without retrying (unmount / intentional cancel).
 */
export async function fetchWithNetworkRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 2, delayMs = 1000, signal, ...fetchInit } = options;
  const maxAttempts = retries + 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const res = await fetch(url, { ...fetchInit, signal });
      if (res.status >= 500 && attempt < retries) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }
      if (attempt < retries && isTransientFetchError(error)) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}
