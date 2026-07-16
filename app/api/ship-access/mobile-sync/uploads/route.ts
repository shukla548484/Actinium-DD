import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileShipAccessContext } from "@/lib/auth/mobileShipAccess";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { addVesselJobAttachment } from "@/lib/db/vesselJobAttachments";
import { getDdVesselJob } from "@/lib/db/superintendent/vesselJobs";
import { prisma } from "@/lib/prisma";
import { assertShipVesselInScope } from "@/lib/shipAccess/scope";
import { saveLocalUpload } from "@/lib/storage/localUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uploadMetaSchema = z.object({
  entityType: z.enum(["vessel_job", "machinery_condition", "generic"]),
  entityId: z.string().nullable().optional(),
  vesselId: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const mobileAuth = await requireMobileShipAccessContext(request);
  if (!mobileAuth.ok) {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;
  }

  const formData = (await request.formData()) as unknown as {
    get: (name: string) => FormDataEntryValue | null;
  };
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const parsed = uploadMetaSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    vesselId: formData.get("vesselId"),
    caption: formData.get("caption"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid upload metadata" },
      { status: 400 },
    );
  }

  const caption = parsed.data.caption?.trim() || null;

  if (parsed.data.entityType === "vessel_job") {
    if (!parsed.data.entityId) {
      return NextResponse.json({ error: "entityId is required for vessel job uploads" }, { status: 400 });
    }

    const job = await getDdVesselJob(parsed.data.entityId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (mobileAuth.ok) {
      const hasVessel = mobileAuth.context.vessels.some((vessel) => vessel.id === job.vesselId);
      if (!hasVessel) {
        return NextResponse.json(
          { error: "Forbidden — vessel not in your mobile scope" },
          { status: 403 },
        );
      }
    } else {
      const access = await assertShipVesselInScope(job.vesselId);
      if (!access.ok) return access.response;
    }

    const saved = await saveLocalUpload({
      file,
      segments: ["ship-access", "mobile", "vessel-jobs", job.id],
    });

    const attachment = await addVesselJobAttachment(job.id, {
      fileName: saved.fileName,
      fileUrl: saved.fileUrl,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      caption,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        entityType: "vessel_job",
        entityId: job.id,
        fileUrl: saved.fileUrl,
        attachmentId: attachment?.id ?? null,
      },
    }, { status: 201 });
  }

  if (parsed.data.entityType === "machinery_condition") {
    if (!parsed.data.entityId) {
      return NextResponse.json(
        { error: "entityId is required for machinery condition uploads" },
        { status: 400 },
      );
    }

    const report = await prisma.vesselMachineryConditionReport.findFirst({
      where: { id: parsed.data.entityId },
      select: { id: true, vesselId: true, recommendations: true },
    });
    if (!report) {
      return NextResponse.json({ error: "Condition report not found" }, { status: 404 });
    }

    if (mobileAuth.ok) {
      const hasVessel = mobileAuth.context.vessels.some((vessel) => vessel.id === report.vesselId);
      if (!hasVessel) {
        return NextResponse.json(
          { error: "Forbidden — vessel not in your mobile scope" },
          { status: 403 },
        );
      }
    } else {
      const access = await assertShipVesselInScope(report.vesselId);
      if (!access.ok) return access.response;
    }

    const saved = await saveLocalUpload({
      file,
      segments: ["ship-access", "mobile", "machinery-condition", report.id],
    });

    const photoRef = `Photo: ${saved.fileUrl}${caption ? ` (${caption})` : ""}`;
    await prisma.vesselMachineryConditionReport.update({
      where: { id: report.id },
      data: {
        recommendations: [report.recommendations?.trim(), photoRef].filter(Boolean).join("\n"),
      },
    });

    return NextResponse.json({
      ok: true,
      upload: {
        entityType: "machinery_condition",
        entityId: report.id,
        fileUrl: saved.fileUrl,
        linkedField: "recommendations",
      },
    }, { status: 201 });
  }

  const vesselId = parsed.data.vesselId?.trim();
  if (!vesselId) {
    return NextResponse.json({ error: "vesselId is required for generic uploads" }, { status: 400 });
  }

  if (mobileAuth.ok) {
    const hasVessel = mobileAuth.context.vessels.some((vessel) => vessel.id === vesselId);
    if (!hasVessel) {
      return NextResponse.json(
        { error: "Forbidden — vessel not in your mobile scope" },
        { status: 403 },
      );
    }
  } else {
    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;
  }

  const saved = await saveLocalUpload({
    file,
    segments: ["ship-access", "mobile", "generic", vesselId],
  });

  return NextResponse.json({
    ok: true,
    upload: {
      entityType: "generic",
      entityId: null,
      fileUrl: saved.fileUrl,
      caption,
    },
  }, { status: 201 });
}
