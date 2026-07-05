import { NextResponse } from "next/server";
import type { JobLibraryNodeType } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  allowedChildNodeTypes,
  createAdminJobLibraryNode,
  listAdminJobLibraryNodes,
} from "@/lib/db/jobLibraryAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const search = searchParams.get("search") ?? undefined;
  const includeInactive = searchParams.get("includeInactive") === "true";

  const nodes = await listAdminJobLibraryNodes({
    parentId: parentId === "root" ? null : parentId,
    search,
    includeInactive,
  });

  const parentType = searchParams.get("parentType") as JobLibraryNodeType | null;
  const childTypes = allowedChildNodeTypes(parentType);

  return NextResponse.json({ nodes, childTypes });
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const body = (await request.json()) as {
    parentId?: string | null;
    nodeType: JobLibraryNodeType;
    code: string;
    name: string;
    description?: string | null;
    department?: string | null;
    workshop?: string | null;
    referenceCode?: string | null;
    defaultPriority?: string | null;
    estimatedManhours?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  };

  if (!body.code?.trim() || !body.name?.trim() || !body.nodeType) {
    return NextResponse.json({ error: "code, name, and nodeType are required." }, { status: 400 });
  }

  const result = await createAdminJobLibraryNode({
    parentId: body.parentId ?? null,
    nodeType: body.nodeType,
    code: body.code,
    name: body.name,
    description: body.description,
    department: body.department,
    workshop: body.workshop,
    referenceCode: body.referenceCode,
    defaultPriority: body.defaultPriority as import("@prisma/client").DdJobPriority | null,
    estimatedManhours: body.estimatedManhours,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ node: result.node }, { status: 201 });
}
