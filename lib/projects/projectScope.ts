import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { requireOfficeApiPermission } from "@/lib/auth/officePageAccess";
import {
  assertProjectInUserScope,
  buildUserScope,
  projectScopeWhere,
  type UserScope,
} from "@/lib/rbac/scopeRules";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import { mapProject } from "@/lib/db/mappers";
import type { Project } from "@/lib/tender/types";

export async function requireProjectsApiAccess(
  permission = "page.office.projects",
): Promise<NextResponse | null> {
  return requireOfficeApiPermission(permission);
}

export async function getSessionProjectScope(): Promise<UserScope | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return buildUserScope(userId);
}

export async function listScopedProjects(): Promise<Project[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const scope = await buildUserScope(userId);
  const rows = await prisma.project.findMany({
    where: { ...notDeleted, ...projectScopeWhere(scope) },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapProject);
}

export async function assertScopedProjectAccess(
  projectId: string,
): Promise<{ ok: true; scope: UserScope } | { ok: false; response: NextResponse }> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 }),
    };
  }

  const scope = await buildUserScope(userId);
  const access = await assertProjectInUserScope(projectId, scope);
  if (!access.ok) return { ok: false, response: access.response };
  return { ok: true, scope };
}
