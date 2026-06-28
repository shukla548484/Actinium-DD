import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, isAuthEnabled, verifySessionTokenEdge } from "@/lib/auth/edge";

export async function middleware(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const isProtected =
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname.startsWith("/api/projects") ||
    pathname === "/shipyard" ||
    pathname.startsWith("/shipyard/") ||
    pathname === "/ship-access" ||
    pathname.startsWith("/ship-access/") ||
    pathname.startsWith("/api/ship-access") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin") ||
    pathname === "/superintendent" ||
    pathname.startsWith("/superintendent/") ||
    pathname.startsWith("/api/superintendent") ||
    pathname === "/account" ||
    pathname.startsWith("/account/");

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (await verifySessionTokenEdge(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/projects",
    "/projects/:path*",
    "/api/projects/:path*",
    "/shipyard",
    "/shipyard/:path*",
    "/ship-access",
    "/ship-access/:path*",
    "/api/ship-access/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/superintendent",
    "/superintendent/:path*",
    "/api/superintendent/:path*",
    "/account",
    "/account/:path*",
  ],
};
