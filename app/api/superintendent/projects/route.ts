import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  findVessel,
  paginatedResult,
  parsePagination,
  scopedDryDockProjectWhere,
} from "@/lib/superintendent/helpers";
import {
  assertVesselInScope,
  getScopedVesselIds,
} from "@/lib/superintendent/scope";
import {
  dryDockProjectCreateSchema,
  parseBody,
} from "@/lib/superintendent/validation";
import { createDryDockProject } from "@/lib/db/superintendent/projects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const vesselId = searchParams.get("vesselId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const vesselIds = await getScopedVesselIds();
  if (vesselId && vesselIds && !vesselIds.includes(vesselId)) {
    return NextResponse.json(paginatedResult([], 0, page, limit));
  }

  const where = await scopedDryDockProjectWhere({
    ...(vesselId ? { vesselId } : {}),
    ...(status ? { status: status as Prisma.EnumDryDockProjectStatusFilter["equals"] } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { referenceCode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  });

  if (vesselIds?.length === 0) {
    return NextResponse.json(paginatedResult([], 0, page, limit));
  }

  const [total, projects] = await Promise.all([
    prisma.dryDockProject.count({ where }),
    prisma.dryDockProject.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        vessel: { select: { id: true, name: true, code: true } },
      },
    }),
  ]);

  return NextResponse.json(paginatedResult(projects, total, page, limit));
}

export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(dryDockProjectCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const vessel = await findVessel(parsed.data.vesselId);
  if (!vessel) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  const vesselAccess = await assertVesselInScope(parsed.data.vesselId);
  if (!vesselAccess.ok) return vesselAccess.response;

  try {
    const project = await createDryDockProject({
      ...parsed.data,
      referenceCode: null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create project";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Project ID already exists" }, { status: 409 });
    }
    if (msg.includes("Unknown argument") || msg.includes("Invalid `prisma.")) {
      console.error("[superintendent/projects POST]", msg);
      return NextResponse.json(
        {
          error:
            "Database client is out of date. Stop the dev server, run `npm run db:generate && npm run fleet:migrate`, then restart with `npm run dev`.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
