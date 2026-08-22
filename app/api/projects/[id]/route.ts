import { NextResponse } from "next/server";
import { getOfficeAuthContext } from "@/lib/auth/officePageAccess";
import { deleteProject, getProjectDetail, updateProject } from "@/lib/db/index";
import { denyProjectDeleteUnlessAdmin } from "@/lib/projects/archive";
import { assertScopedProjectAccess, requireProjectsApiAccess } from "@/lib/projects/projectScope";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const project = await getProjectDetail(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const body = await request.json();
  try {
    const project = await updateProject(id, body);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project.";
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const auth = await getOfficeAuthContext();
  const adminDenied = denyProjectDeleteUnlessAdmin(auth);
  if (adminDenied) return adminDenied;

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const ok = await deleteProject(id);
  if (!ok) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
