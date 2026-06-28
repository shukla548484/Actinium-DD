export const COOKIE_NAME = "dd_office_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function isAuthEnabled(): boolean {
  return Boolean(process.env.OFFICE_AUTH_PASSWORD?.length);
}

export function authSecret(): string {
  return process.env.OFFICE_AUTH_SECRET ?? "change-me-in-production";
}

export function sessionMaxAgeSec(): number {
  return SESSION_MAX_AGE_SEC;
}

function parsePayloadPart(payload: string): { exp?: number } | null {
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return JSON.parse(atob(b64)) as { exp?: number };
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Edge-safe session verification (middleware). */
export async function verifySessionTokenEdge(token: string | undefined | null): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bytesToBase64Url(new Uint8Array(mac));
  if (sig !== expected) return false;

  const data = parsePayloadPart(payload);
  return typeof data?.exp === "number" && data.exp > Date.now();
}
