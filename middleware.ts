import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, isAuthEnabled, parseSessionTokenEdge } from "@/lib/auth/edge";
import {
  isApiAllowedForUserType,
  isPublicPath,
  redirectPathForBlockedUserType,
  resolveSessionUserType,
} from "@/lib/auth/portalAccess";
import type { RbacUserType } from "@prisma/client";

const PROTECTED_PREFIXES = [
  "/projects",
  "/shipyard",
  "/ship-access",
  "/admin",
  "/superintendent",
  "/external",
  "/account",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/shipyard") ||
    pathname.startsWith("/api/ship-access") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/superintendent") ||
    pathname.startsWith("/api/mtil") ||
    pathname.startsWith("/api/external")
  );
}

function resolveUserType(session: {
  rbacUserType?: string;
  isVesselCrew?: boolean;
  officeBootstrap?: boolean;
}): RbacUserType {
  return resolveSessionUserType({
    rbacUserType: session.rbacUserType as RbacUserType | undefined,
    isVesselCrew: session.isVesselCrew,
    officeBootstrap: session.officeBootstrap,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const protectedRoute = isProtectedPath(pathname) || isProtectedApi(pathname);
  if (!protectedRoute) return NextResponse.next();

  if (!isAuthEnabled()) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await parseSessionTokenEdge(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const userType = resolveUserType(session);

  if (pathname.startsWith("/api/")) {
    if (!isApiAllowedForUserType(pathname, userType)) {
      return NextResponse.json({ error: "Forbidden for your user type." }, { status: 403 });
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const redirectTo = redirectPathForBlockedUserType(pathname, userType);
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/",
    "/projects",
    "/projects/:path*",
    "/api/projects/:path*",
    "/shipyard",
    "/shipyard/:path*",
    "/api/shipyard/:path*",
    "/ship-access",
    "/ship-access/:path*",
    "/api/ship-access/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/superintendent",
    "/superintendent/:path*",
    "/api/superintendent/:path*",
    "/api/mtil/:path*",
    "/external",
    "/external/:path*",
    "/api/external/:path*",
    "/platform",
    "/platform/:path*",
    "/office",
    "/office/:path*",
    "/account",
    "/account/:path*",
    "/login",
    "/login/:path*",
    "/quote/:path*",
  ],
};
