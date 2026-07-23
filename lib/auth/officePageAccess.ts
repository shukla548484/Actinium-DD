import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAuthEnabled } from "@/lib/auth/edge";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";
import { buildAuthContext, can, canAccessPage } from "@/lib/db/rbac";
import type { AuthContext } from "@/lib/rbac/types";
import { pagePermissionForPath } from "@/lib/rbac/rolePermissions";
import { portalHomeForUserType } from "@/lib/rbac/userTypes";

/** Admin API routes → minimum page permission. */
const ADMIN_API_PERMISSIONS: { pattern: RegExp; permission: string }[] = [
  { pattern: /^\/api\/admin\/companies/, permission: "page.office.admin.companies" },
  { pattern: /^\/api\/admin\/shipyards/, permission: "page.office.admin.shipyards" },
  { pattern: /^\/api\/admin\/external-vendors/, permission: "page.office.admin.externalVendors" },
  { pattern: /^\/api\/admin\/vessels/, permission: "page.office.admin.vessels" },
  { pattern: /^\/api\/admin\/employees/, permission: "page.office.admin.employees" },
  { pattern: /^\/api\/admin\/roles/, permission: "page.office.admin.roles" },
  { pattern: /^\/api\/admin\/permissions/, permission: "page.office.admin.access" },
  { pattern: /^\/api\/admin\/master-catalog/, permission: "page.office.admin" },
  { pattern: /^\/api\/admin\/stats/, permission: "page.office.admin" },
  { pattern: /^\/api\/admin/, permission: "page.office.admin" },
];

/** Superintendent API routes → page permission (fallback: any superintendent page). */
const SUPERINTENDENT_API_PERMISSIONS: { pattern: RegExp; permission: string }[] = [
  { pattern: /^\/api\/superintendent\/vessel-pms/, permission: "page.superintendent.vesselJobs" },
  { pattern: /^\/api\/superintendent\/vessel-requisitions/, permission: "page.superintendent.procurement" },
  { pattern: /^\/api\/superintendent\/purchase-orders/, permission: "page.superintendent.procurement" },
  { pattern: /^\/api\/superintendent\/invoices/, permission: "page.superintendent.procurement" },
  { pattern: /^\/api\/superintendent\/budget/, permission: "page.superintendent.budget" },
  { pattern: /^\/api\/superintendent\/daily-reports/, permission: "page.superintendent.monitoring" },
  { pattern: /^\/api\/superintendent\/delays/, permission: "page.superintendent.monitoring" },
  { pattern: /^\/api\/superintendent\/approvals/, permission: "page.superintendent.approvals" },
  { pattern: /^\/api\/superintendent\/spares/, permission: "page.superintendent.spares" },
  { pattern: /^\/api\/superintendent\/vessel-jobs/, permission: "page.superintendent.vesselJobs" },
  { pattern: /^\/api\/superintendent\/quotations/, permission: "page.superintendent.vesselJobs" },
  { pattern: /^\/api\/superintendent\/projects/, permission: "page.superintendent.projectWorkspace" },
  { pattern: /^\/api\/superintendent\/vessels/, permission: "page.superintendent.vessels" },
  { pattern: /^\/api\/superintendent\/jobs/, permission: "page.superintendent.jobs" },
  { pattern: /^\/api\/superintendent/, permission: "page.superintendent.dashboard" },
];

export function adminApiPermissionForPath(pathname: string): string {
  for (const { pattern, permission } of ADMIN_API_PERMISSIONS) {
    if (pattern.test(pathname)) return permission;
  }
  return "page.office.admin";
}

export function superintendentApiPermissionForPath(pathname: string): string {
  for (const { pattern, permission } of SUPERINTENDENT_API_PERMISSIONS) {
    if (pattern.test(pathname)) return permission;
  }
  return "page.superintendent.dashboard";
}

export async function getOfficeAuthContext(): Promise<AuthContext | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return buildAuthContext(userId);
}

function hasSuperintendentAccess(context: AuthContext): boolean {
  if (can(context, "platform.tenant.manage")) return true;
  for (const key of context.permissions) {
    if (key.startsWith("page.superintendent.")) return true;
  }
  return false;
}

/** Redirect unauthenticated or unauthorized office users away from a page route. */
export async function enforceOfficePageAccess(pathname: string): Promise<void> {
  if (!isAuthEnabled()) return;

  const payload = await getSessionPayload();
  if (!payload) redirect("/login");

  if (payload.officeBootstrap) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/platform")) {
      redirect("/projects");
    }
    return;
  }

  const permission = pagePermissionForPath(pathname);
  if (!permission) return;

  const ctx = await getOfficeAuthContext();
  if (!ctx || !canAccessPage(ctx, permission)) {
    redirect(portalHomeForUserType("office"));
  }
}

async function resolveRequestPath(request?: Request): Promise<string | null> {
  if (request) return new URL(request.url).pathname;
  return (await headers()).get("x-pathname");
}

export async function requireOfficeApiPermission(
  permission: string,
): Promise<NextResponse | null> {
  if (!isAuthEnabled()) return null;

  const payload = await getSessionPayload();
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  if (payload.officeBootstrap) {
    return NextResponse.json(
      { error: "Sign in with your employee login ID for this feature." },
      { status: 403 },
    );
  }

  const ctx = await buildAuthContext(payload.userId);
  if (!ctx || !canAccessPage(ctx, permission)) {
    return NextResponse.json({ error: "You do not have access to this feature." }, { status: 403 });
  }

  return null;
}

export async function requireAdminApiPermission(request?: Request): Promise<NextResponse | null> {
  const pathname = await resolveRequestPath(request);
  const permission = pathname ? adminApiPermissionForPath(pathname) : "page.office.admin";
  return requireOfficeApiPermission(permission);
}

export async function requireSuperintendentApiPermission(
  request?: Request,
): Promise<NextResponse | null> {
  if (!isAuthEnabled()) return null;

  const payload = await getSessionPayload();
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  if (payload.officeBootstrap) {
    return NextResponse.json(
      { error: "Sign in with your employee login ID for superintendent access." },
      { status: 403 },
    );
  }

  const ctx = await buildAuthContext(payload.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pathname = await resolveRequestPath(request);
  const permission = pathname
    ? superintendentApiPermissionForPath(pathname)
    : "page.superintendent.dashboard";

  if (!canAccessPage(ctx, permission) && !hasSuperintendentAccess(ctx)) {
    return NextResponse.json(
      { error: "You do not have superintendent module access." },
      { status: 403 },
    );
  }

  return null;
}
