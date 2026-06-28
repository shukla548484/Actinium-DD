import { NextResponse } from "next/server";
import { deleteProjectCategory, updateProjectCategory } from "@/lib/db/categories";
import { getProject } from "@/lib/db/index";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; categoryId: string }> },
) {
  const { id, categoryId } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string; shortcut?: string };
  if (body.name == null && body.shortcut == null) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const category = await updateProjectCategory(id, categoryId, body);
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    return NextResponse.json({ category });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update category." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; categoryId: string }> },
) {
  const { id, categoryId } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const ok = await deleteProjectCategory(id, categoryId);
  if (!ok) {
    return NextResponse.json(
      { error: "Category not found or cannot delete a system category." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
