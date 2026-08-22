import { NextResponse } from "next/server";
import { getOfficeAuthContext } from "@/lib/auth/officePageAccess";
import { getSessionUserId } from "@/lib/auth/session";
import {
  archiveTenderProject,
  denyUnarchiveUnlessAllowed,
  unarchiveTenderProject,
} from "@/lib/projects/archive";
import { assertScopedProjectAccess, requireProjectsApiAccess } from "@/lib/projects/projectScope";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const existing = await prisma.project.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, archivedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json({ ok: true, alreadyArchived: true });
  }

  await archiveTenderProject(id, userId);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/projects/[id]/archive — unarchive (archiver or admin). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const existing = await prisma.project.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, archivedAt: true, archivedByUserId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (!existing.archivedAt) {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  const auth = await getOfficeAuthContext();
  const unarchiveDenied = denyUnarchiveUnlessAllowed(
    auth,
    userId,
    existing.archivedByUserId,
  );
  if (unarchiveDenied) return unarchiveDenied;

  await unarchiveTenderProject(id);
  return NextResponse.json({ ok: true });
}
