import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  authSecret,
  COOKIE_NAME,
  isAuthEnabled,
  sessionMaxAgeSec,
} from "@/lib/auth/edge";

export { COOKIE_NAME, isAuthEnabled } from "@/lib/auth/edge";

export type SessionPayload = {
  exp: number;
  userId?: string;
  loginId?: string;
  officeBootstrap?: boolean;
  isVesselCrew?: boolean;
  rbacUserType?: import("@prisma/client").RbacUserType;
};

export function verifyOfficePassword(password: string): boolean {
  if (!isAuthEnabled()) return true;
  const expected = process.env.OFFICE_AUTH_PASSWORD ?? "";
  if (!expected || password.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}

/** @deprecated Use verifyOfficePassword */
export function verifyPassword(password: string): boolean {
  return verifyOfficePassword(password);
}

export function createSessionToken(payload: Omit<SessionPayload, "exp"> = {}): string {
  const exp = Date.now() + sessionMaxAgeSec() * 1000;
  const body: SessionPayload = { exp, ...payload };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
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
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!isAuthEnabled()) return true;
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
  if (!isAuthEnabled()) return true;
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  if (!isAuthEnabled()) return { exp: Date.now() + sessionMaxAgeSec() * 1000 };
  const jar = await cookies();
  return parseSessionToken(jar.get(COOKIE_NAME)?.value);
}

export async function getSessionUserId(): Promise<string | null> {
  const payload = await getSessionPayload();
  return payload?.userId ?? null;
}
