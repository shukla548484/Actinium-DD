import { NextResponse } from "next/server";
import {
  createProjectCategory,
  deleteProjectCategory,
  ensureProjectCategories,
  updateProjectCategory,
} from "@/lib/db/categories";
import { getProject } from "@/lib/db/index";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const categories = await ensureProjectCategories(id);
  return NextResponse.json({ categories });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string; shortcut?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }

  try {
    const category = await createProjectCategory({
      projectId: id,
      name: body.name,
      shortcut: body.shortcut,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create category." },
      { status: 400 },
    );
  }
}
