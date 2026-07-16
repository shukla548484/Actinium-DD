/** Parse JSON API responses; surface Vercel payload / timeout errors clearly. */
export async function readPurchaseUploadJsonResponse(
  response: Response
): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`Empty response from server (HTTP ${response.status})`);
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const upper = raw.toUpperCase();
    if (response.status === 413 || upper.includes("FUNCTION_PAYLOAD_TOO_LARGE")) {
      throw new Error(
        "File is too large for direct server upload. Please retry — large files upload directly to cloud storage."
      );
    }
    if (upper.includes("FUNCTION_INVOCATION")) {
      throw new Error("Upload timed out on the server. Please try again.");
    }
    throw new Error(
      `Server returned an unexpected response (HTTP ${response.status}). ${raw.slice(0, 200)}`
    );
  }
}
