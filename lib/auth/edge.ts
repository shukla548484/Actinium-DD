import { SESSION_IDLE_TIMEOUT_SEC } from "@/lib/auth/constants";

export const COOKIE_NAME = "dd_office_session";

/** Auth is always required — no anonymous access to application routes. */
export function isAuthEnabled(): boolean {
  return true;
}

export function authSecret(): string {
  const secret = process.env.OFFICE_AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] OFFICE_AUTH_SECRET is missing or too short — set a 32+ char secret in production.");
  }
  return secret ?? "change-me-in-production";
}

export function sessionIdleTimeoutSec(): number {
  const raw = process.env.SESSION_IDLE_TIMEOUT_SEC;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return SESSION_IDLE_TIMEOUT_SEC;
}

export function sessionMaxAgeSec(): number {
  return sessionIdleTimeoutSec();
}

function parsePayloadPart(payload: string): {
  exp?: number;
  lastActive?: number;
  isVesselCrew?: boolean;
  officeBootstrap?: boolean;
  rbacUserType?: string;
  userId?: string;
} | null {
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return JSON.parse(atob(b64)) as {
      exp?: number;
      lastActive?: number;
      isVesselCrew?: boolean;
      officeBootstrap?: boolean;
      rbacUserType?: string;
      userId?: string;
    };
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isSessionTimedOut(data: { exp?: number; lastActive?: number }): boolean {
  const now = Date.now();
  const idleMs = sessionIdleTimeoutSec() * 1000;
  if (typeof data.lastActive === "number" && data.lastActive + idleMs <= now) return true;
  if (typeof data.exp === "number" && data.exp <= now) return true;
  return false;
}

/** Edge-safe session verification (middleware). */
export async function verifySessionTokenEdge(token: string | undefined | null): Promise<boolean> {
  return (await parseSessionTokenEdge(token)) != null;
}

/** Edge-safe session payload for middleware routing. */
export async function parseSessionTokenEdge(
  token: string | undefined | null,
): Promise<{
  exp: number;
  lastActive: number;
  isVesselCrew?: boolean;
  officeBootstrap?: boolean;
  rbacUserType?: string;
  userId?: string;
} | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bytesToBase64Url(new Uint8Array(mac));
  if (sig !== expected) return null;

  const data = parsePayloadPart(payload);
  if (!data || isSessionTimedOut(data)) return null;

  return {
    exp: data.exp ?? Date.now() + sessionIdleTimeoutSec() * 1000,
    lastActive: data.lastActive ?? Date.now(),
    isVesselCrew: data.isVesselCrew,
    officeBootstrap: data.officeBootstrap,
    rbacUserType: data.rbacUserType,
    userId: data.userId,
  };
}
