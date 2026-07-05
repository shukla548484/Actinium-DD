import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  getAdminJobLibraryNode,
  getJobLibraryBreadcrumb,
  softDeleteAdminJobLibraryNode,
  updateAdminJobLibraryNode,
} from "@/lib/db/jobLibraryAdmin";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const node = await getAdminJobLibraryNode(id);
  if (!node) return NextResponse.json({ error: "Node not found." }, { status: 404 });

  const breadcrumb = await getJobLibraryBreadcrumb(id);
  return NextResponse.json({ node, breadcrumb });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = (await request.json()) as {
    code?: string;
    name?: string;
    description?: string | null;
    department?: string | null;
    workshop?: string | null;
    referenceCode?: string | null;
    defaultPriority?: string | null;
    estimatedManhours?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  };

  const node = await updateAdminJobLibraryNode(id, {
    ...body,
    defaultPriority: body.defaultPriority as import("@prisma/client").DdJobPriority | null,
  });

  if (!node) {
    return NextResponse.json({ error: "Node not found or code conflict." }, { status: 404 });
  }

  return NextResponse.json({ node });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const ok = await softDeleteAdminJobLibraryNode(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete — node missing or has children." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
