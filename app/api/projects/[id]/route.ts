import { NextResponse } from "next/server";
import { deleteProject, getProjectDetail, updateProject } from "@/lib/db/index";
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
  const project = await updateProject(id, body);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const { id } = await context.params;
  const access = await assertScopedProjectAccess(id);
  if (!access.ok) return access.response;

  const ok = await deleteProject(id);
  if (!ok) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
