import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: jobId } = await ctx.params;
  const job = await prisma.ddJob.findFirst({
    where: { id: jobId, ...notDeleted },
    select: { id: true, dryDockProjectId: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(job.dryDockProjectId);
  if (!access.ok) return access.response;

  const attachments = await prisma.ddJobAttachment.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ attachments });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id: jobId } = await ctx.params;
  const job = await prisma.ddJob.findFirst({
    where: { id: jobId, ...notDeleted },
    select: { id: true, dryDockProjectId: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(job.dryDockProjectId);
  if (!access.ok) return access.response;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(process.cwd(), "public", "uploads", "superintendent", jobId);
  await mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${safeName}`;
  const diskPath = path.join(dir, storedName);
  await writeFile(diskPath, bytes);

  const fileUrl = `/uploads/superintendent/${jobId}/${storedName}`;
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  const attachment = await prisma.ddJobAttachment.create({
    data: {
      jobId,
      fileName: file.name,
      fileUrl,
      mimeType: file.type || null,
      fileSize: bytes.length,
      caption,
    },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
