import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  authSecret,
  COOKIE_NAME,
  isAuthEnabled,
  sessionIdleTimeoutSec,
  sessionMaxAgeSec,
} from "@/lib/auth/edge";

export { COOKIE_NAME, isAuthEnabled, sessionIdleTimeoutSec, sessionMaxAgeSec } from "@/lib/auth/edge";

export type SessionPayload = {
  exp: number;
  lastActive: number;
  userId?: string;
  loginId?: string;
  officeBootstrap?: boolean;
  isVesselCrew?: boolean;
  rbacUserType?: import("@prisma/client").RbacUserType;
};

function isSessionTimedOut(data: Pick<SessionPayload, "exp" | "lastActive">): boolean {
  const now = Date.now();
  const idleMs = sessionIdleTimeoutSec() * 1000;
  if (data.lastActive + idleMs <= now) return true;
  if (data.exp <= now) return true;
  return false;
}

export function verifyOfficePassword(password: string): boolean {
  const expected = process.env.OFFICE_AUTH_PASSWORD ?? "";
  if (!expected || password.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}

/** @deprecated Use verifyOfficePassword */
export function verifyPassword(password: string): boolean {
  return verifyOfficePassword(password);
}

export function createSessionToken(payload: Omit<SessionPayload, "exp" | "lastActive"> = {}): string {
  const now = Date.now();
  const idleMs = sessionIdleTimeoutSec() * 1000;
  const body: SessionPayload = {
    exp: now + idleMs,
    lastActive: now,
    ...payload,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/** Extend idle deadline for an existing session (user activity). */
export function refreshSessionToken(payload: SessionPayload): string {
  const { exp: _exp, lastActive: _lastActive, ...rest } = payload;
  return createSessionToken(rest);
}

export function parseSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (typeof data.exp !== "number" || typeof data.lastActive !== "number") return null;
    if (isSessionTimedOut(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  return parseSessionToken(token) != null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionMaxAgeSec(),
  };
}

export async function getOfficeSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return parseSessionToken(jar.get(COOKIE_NAME)?.value);
}

export async function getSessionUserId(): Promise<string | null> {
  const payload = await getSessionPayload();
  return payload?.userId ?? null;
}

export async function setSessionCookie(
  response: { cookies: { set: (name: string, value: string, options: object) => void } },
  payload: Omit<SessionPayload, "exp" | "lastActive">,
) {
  response.cookies.set(COOKIE_NAME, createSessionToken(payload), sessionCookieOptions());
}

export async function touchSessionCookie(
  response: { cookies: { set: (name: string, value: string, options: object) => void } },
  payload: SessionPayload,
) {
  response.cookies.set(COOKIE_NAME, refreshSessionToken(payload), sessionCookieOptions());
}
