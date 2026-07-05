import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, isAuthEnabled, parseSessionTokenEdge } from "@/lib/auth/edge";
import {
  isApiAllowedForUserType,
  redirectPathForBlockedUserType,
  resolveSessionUserType,
} from "@/lib/auth/portalAccess";
import type { RbacUserType } from "@prisma/client";

const AUTH_API_PREFIXES = ["/api/auth/login", "/api/auth/logout"] as const;

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|woff2?|ttf|map)$/i.test(pathname)
  );
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function isPublicAuthApi(pathname: string): boolean {
  return AUTH_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicRoute(pathname: string): boolean {
  if (isStaticAsset(pathname)) return true;
  if (isLoginPath(pathname)) return true;
  if (isPublicAuthApi(pathname)) return true;
  return false;
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

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await parseSessionTokenEdge(token);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Sign in at /login.", code: "SESSION_EXPIRED" },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    if (!isLoginPath(pathname)) {
      login.searchParams.set("next", pathname);
    }
    login.searchParams.set("reason", "auth_required");
    return NextResponse.redirect(login);
  }

  if (isLoginPath(pathname)) {
    const home = new URL("/", request.url);
    return NextResponse.redirect(home);
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
  matcher: ["/((?!_next/static|_next/image).*)"],
};
