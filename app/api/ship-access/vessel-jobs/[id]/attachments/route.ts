import { NextResponse } from "next/server";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { listVesselJobAttachments, addVesselJobAttachment } from "@/lib/db/vesselJobAttachments";
import { getDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { saveLocalUpload } from "@/lib/storage/localUpload";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const job = await getDdVesselJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(job.vesselId);
  if (!access.ok) return access.response;

  const attachments = await listVesselJobAttachments(id);
  if (attachments == null) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ attachments });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const job = await getDdVesselJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const access = await assertShipVesselInScope(job.vesselId);
  if (!access.ok) return access.response;

  if (job.status === "integrated" || job.status === "rejected") {
    return NextResponse.json({ error: "Cannot attach files to this job" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const saved = await saveLocalUpload({
    file,
    segments: ["ship-access", "vessel-jobs", id],
  });
  const caption = (formData.get("caption") as string | null)?.trim() || null;

  const attachment = await addVesselJobAttachment(id, {
    fileName: saved.fileName,
    fileUrl: saved.fileUrl,
    mimeType: saved.mimeType,
    fileSize: saved.fileSize,
    caption,
  });

  if (!attachment) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ attachment }, { status: 201 });
}
