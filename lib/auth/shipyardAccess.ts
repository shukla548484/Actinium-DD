import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isAuthEnabled } from "@/lib/auth/edge";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";
import { buildAuthContext, can, canAccessPage } from "@/lib/db/rbac";
import type { AuthContext } from "@/lib/rbac/types";
import { pagePermissionForPath } from "@/lib/rbac/rolePermissions";
import { canAccessWorkshopSlug, workshopPermissionForSlug } from "@/lib/shipyard/workshopPermissions";
import { prisma } from "@/lib/prisma";

async function resolveRequestPath(request?: Request): Promise<string | null> {
  if (request) return new URL(request.url).pathname;
  return (await headers()).get("x-pathname");
}

export async function getShipyardAuthContext(): Promise<AuthContext | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return buildAuthContext(userId);
}

export async function requireShipyardApiAccess(request?: Request): Promise<NextResponse | null> {
  if (!isAuthEnabled()) return null;

  const payload = await getSessionPayload();
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const ctx = await buildAuthContext(payload.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pathname = await resolveRequestPath(request);
  const pagePermission = pathname ? pagePermissionForPath(pathname) : "page.shipyard.dashboard";
  const hasPage =
    (pagePermission && canAccessPage(ctx, pagePermission)) ||
    canAccessPage(ctx, "page.shipyard.dashboard") ||
    can(ctx, "yard.execution.read") ||
    can(ctx, "yard.execution.manage");

  if (!hasPage) {
    return NextResponse.json({ error: "You do not have shipyard module access." }, { status: 403 });
  }

  return null;
}

/** Verify user can mutate a workshop job (by workshop slug). */
export async function requireWorkshopJobAccess(
  jobId: string,
  request?: Request,
): Promise<NextResponse | null> {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const payload = await getSessionPayload();
  if (!payload?.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ctx = await buildAuthContext(payload.userId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (can(ctx, "yard.execution.manage") || can(ctx, "platform.tenant.manage")) {
    return null;
  }

  const job = await prisma.workshopJob.findUnique({
    where: { id: jobId },
    select: { workshopSlug: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (!canAccessWorkshopSlug(ctx.permissions, job.workshopSlug)) {
    return NextResponse.json(
      { error: `You do not have access to the ${job.workshopSlug} workshop.` },
      { status: 403 },
    );
  }

  const required = workshopPermissionForSlug(job.workshopSlug);
  if (required && !ctx.permissions.has(required) && !ctx.permissions.has("yard.job.update")) {
    return NextResponse.json({ error: "You cannot update jobs in this workshop." }, { status: 403 });
  }

  return null;
}
