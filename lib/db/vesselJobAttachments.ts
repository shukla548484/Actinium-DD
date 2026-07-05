import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export type VesselJobAttachmentMeta = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number;
  caption: string | null;
  createdAt: string;
};

function parseAttachmentMeta(raw: unknown): VesselJobAttachmentMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is VesselJobAttachmentMeta =>
      typeof item === "object" &&
      item != null &&
      typeof (item as VesselJobAttachmentMeta).id === "string" &&
      typeof (item as VesselJobAttachmentMeta).fileUrl === "string",
  );
}

export async function listVesselJobAttachments(vesselJobId: string) {
  const job = await prisma.ddVesselJob.findFirst({
    where: { id: vesselJobId, ...notDeleted },
    select: { attachmentMeta: true },
  });
  if (!job) return null;
  return parseAttachmentMeta(job.attachmentMeta);
}

export async function addVesselJobAttachment(
  vesselJobId: string,
  input: {
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    fileSize: number;
    caption?: string | null;
  },
) {
  const job = await prisma.ddVesselJob.findFirst({
    where: { id: vesselJobId, ...notDeleted },
    select: { id: true, attachmentMeta: true, photoCount: true },
  });
  if (!job) return null;

  const existing = parseAttachmentMeta(job.attachmentMeta);
  const attachment: VesselJobAttachmentMeta = {
    id: randomUUID(),
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    mimeType: input.mimeType ?? null,
    fileSize: input.fileSize,
    caption: input.caption?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  const next = [...existing, attachment];
  await prisma.ddVesselJob.update({
    where: { id: vesselJobId },
    data: {
      attachmentMeta: next,
      photoCount: next.length,
    },
  });

  return attachment;
}
