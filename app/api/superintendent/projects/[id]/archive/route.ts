import { NextResponse } from "next/server";
import { getOfficeAuthContext } from "@/lib/auth/officePageAccess";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { getSessionUserId } from "@/lib/auth/session";
import {
  archiveDryDockProject,
  denyUnarchiveUnlessAllowed,
  unarchiveDryDockProject,
} from "@/lib/projects/archive";
import { findDryDockProject } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findDryDockProject(id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  if (existing.archivedAt) {
    return NextResponse.json({ ok: true, alreadyArchived: true });
  }

  await archiveDryDockProject(id, userId);
  return NextResponse.json({ ok: true });
}

/** DELETE — unarchive (archiver or admin). */
export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findDryDockProject(id);
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

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

  await unarchiveDryDockProject(id);
  return NextResponse.json({ ok: true });
}
