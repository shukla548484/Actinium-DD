import { prisma } from "@/lib/prisma";
import type {
  YardAttachmentType,
  YardAttachmentVisibility,
  YardClarificationStatus,
  YardInspectionResult,
  YardPermitType,
  YardRegisterStatus,
} from "@prisma/client";
import { getOrCreateYardWorkProject, updateWorkshopJob } from "@/lib/db/yardExecution";
import type { YardRegisterType } from "@/lib/shipyard/registerTypes";

const notDeleted = { deletedAt: null };

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveYardWorkProjectId(projectId: string) {
  const ywp = await getOrCreateYardWorkProject(projectId);
  return ywp.id;
}

async function jobBelongsToProject(workshopJobId: string | null | undefined, yardWorkProjectId: string) {
  if (!workshopJobId) return true;
  const job = await prisma.workshopJob.findFirst({
    where: { id: workshopJobId, yardWorkProjectId },
  });
  return Boolean(job);
}

export async function listYardRegisterEntries(registerType: YardRegisterType, projectId: string) {
  const yardWorkProjectId = await resolveYardWorkProjectId(projectId);
  const include = {
    workshopJob: { select: { id: true, jobCode: true, jobTitle: true, workshopSlug: true } },
  };

  switch (registerType) {
    case "daily-progress":
      return prisma.yardDailyProgress.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { reportDate: "desc" },
      });
    case "delays":
      return prisma.yardDelayEntry.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
    case "permits":
      return prisma.yardPermitEntry.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
    case "inspections":
      return prisma.yardInspectionEntry.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
    case "clarifications":
      return prisma.yardClarification.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
    case "variations":
      return prisma.yardVariationEntry.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
    case "attachments":
      return prisma.yardJobAttachment.findMany({
        where: { yardWorkProjectId, ...notDeleted },
        include,
        orderBy: { createdAt: "desc" },
      });
  }
}

export async function createYardRegisterEntry(
  registerType: YardRegisterType,
  projectId: string,
  body: Record<string, unknown>,
) {
  const yardWorkProjectId = await resolveYardWorkProjectId(projectId);
  const workshopJobId = typeof body.workshopJobId === "string" ? body.workshopJobId : null;
  if (!(await jobBelongsToProject(workshopJobId, yardWorkProjectId))) {
    throw new Error("Invalid workshop job for this project");
  }

  switch (registerType) {
    case "daily-progress": {
      const reportDate = parseDate(body.reportDate);
      if (!reportDate) throw new Error("reportDate is required");
      const progressPct = typeof body.progressPct === "number" ? body.progressPct : null;
      const row = await prisma.yardDailyProgress.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          reportDate,
          progressPct,
          manpowerCount: typeof body.manpowerCount === "number" ? body.manpowerCount : null,
          remarks: typeof body.remarks === "string" ? body.remarks.trim() || null : null,
          updatedBy: typeof body.updatedBy === "string" ? body.updatedBy.trim() || null : null,
        },
        include: { workshopJob: true },
      });
      if (workshopJobId && progressPct != null) {
        await updateWorkshopJob(workshopJobId, {
          progressPct,
          status: progressPct >= 100 ? "completed" : "in_progress",
        });
      }
      return row;
    }
    case "delays": {
      const delayReason = typeof body.delayReason === "string" ? body.delayReason.trim() : "";
      if (!delayReason) throw new Error("delayReason is required");
      const row = await prisma.yardDelayEntry.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          delayReason,
          impactDays: typeof body.impactDays === "number" ? body.impactDays : null,
          ownerAction: typeof body.ownerAction === "string" ? body.ownerAction.trim() || null : null,
          status: (body.status as YardRegisterStatus) ?? "open",
          sinceDate: parseDate(body.sinceDate) ?? null,
        },
        include: { workshopJob: true },
      });
      if (workshopJobId) {
        await updateWorkshopJob(workshopJobId, { delayReason, status: "blocked" });
      }
      return row;
    }
    case "permits":
      return prisma.yardPermitEntry.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          permitNo: typeof body.permitNo === "string" ? body.permitNo.trim() || null : null,
          permitType: (body.permitType as YardPermitType) ?? "other",
          validFrom: parseDate(body.validFrom) ?? null,
          validTo: parseDate(body.validTo) ?? null,
          safetyOfficer: typeof body.safetyOfficer === "string" ? body.safetyOfficer.trim() || null : null,
          status: (body.status as YardRegisterStatus) ?? "open",
        },
        include: { workshopJob: true },
      });
    case "inspections":
      return prisma.yardInspectionEntry.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          holdPoint: typeof body.holdPoint === "string" ? body.holdPoint.trim() || null : null,
          inspector: typeof body.inspector === "string" ? body.inspector.trim() || null : null,
          plannedDate: parseDate(body.plannedDate) ?? null,
          completedDate: parseDate(body.completedDate) ?? null,
          result: (body.result as YardInspectionResult) ?? "pending",
          classComment: typeof body.classComment === "string" ? body.classComment.trim() || null : null,
        },
        include: { workshopJob: true },
      });
    case "clarifications": {
      const issueBody = typeof body.body === "string" ? body.body.trim() : "";
      if (!issueBody) throw new Error("body is required");
      return prisma.yardClarification.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          refNo: typeof body.refNo === "string" ? body.refNo.trim() || null : null,
          issueType: typeof body.issueType === "string" ? body.issueType.trim() : "Technical clarification",
          raisedBy: typeof body.raisedBy === "string" ? body.raisedBy.trim() || null : null,
          actionBy: typeof body.actionBy === "string" ? body.actionBy.trim() || null : null,
          body: issueBody,
          ownerReply: typeof body.ownerReply === "string" ? body.ownerReply.trim() || null : null,
          classComment: typeof body.classComment === "string" ? body.classComment.trim() || null : null,
          internalNotes: typeof body.internalNotes === "string" ? body.internalNotes.trim() || null : null,
          status: (body.status as YardClarificationStatus) ?? "open",
        },
        include: { workshopJob: true },
      });
    }
    case "variations": {
      const description = typeof body.description === "string" ? body.description.trim() : "";
      if (!description) throw new Error("description is required");
      return prisma.yardVariationEntry.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          voNumber: typeof body.voNumber === "string" ? body.voNumber.trim() || null : null,
          description,
          raisedBy: typeof body.raisedBy === "string" ? body.raisedBy.trim() || null : null,
          ownerStatus: (body.ownerStatus as YardRegisterStatus) ?? "open",
          commercialImpact: typeof body.commercialImpact === "number" ? body.commercialImpact : null,
          approved: body.approved === true,
        },
        include: { workshopJob: true },
      });
    }
    case "attachments": {
      const filename = typeof body.filename === "string" ? body.filename.trim() : "";
      const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
      if (!filename || !fileUrl) throw new Error("filename and fileUrl are required");
      return prisma.yardJobAttachment.create({
        data: {
          yardWorkProjectId,
          workshopJobId,
          attachmentType: (body.attachmentType as YardAttachmentType) ?? "document",
          filename,
          fileUrl,
          uploadedBy: typeof body.uploadedBy === "string" ? body.uploadedBy.trim() || null : null,
          visibility: (body.visibility as YardAttachmentVisibility) ?? "internal",
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        },
        include: { workshopJob: true },
      });
    }
  }
}

export async function updateYardRegisterEntry(
  registerType: YardRegisterType,
  projectId: string,
  entryId: string,
  body: Record<string, unknown>,
) {
  const yardWorkProjectId = await resolveYardWorkProjectId(projectId);
  const workshopJobId =
    body.workshopJobId === null
      ? null
      : typeof body.workshopJobId === "string"
        ? body.workshopJobId
        : undefined;
  if (workshopJobId !== undefined && !(await jobBelongsToProject(workshopJobId, yardWorkProjectId))) {
    throw new Error("Invalid workshop job for this project");
  }

  switch (registerType) {
    case "daily-progress": {
      const row = await prisma.yardDailyProgress.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.reportDate !== undefined ? { reportDate: parseDate(body.reportDate) ?? undefined } : {}),
          ...(body.progressPct !== undefined
            ? { progressPct: typeof body.progressPct === "number" ? body.progressPct : null }
            : {}),
          ...(body.manpowerCount !== undefined
            ? { manpowerCount: typeof body.manpowerCount === "number" ? body.manpowerCount : null }
            : {}),
          ...(body.remarks !== undefined
            ? { remarks: typeof body.remarks === "string" ? body.remarks.trim() || null : null }
            : {}),
          ...(body.updatedBy !== undefined
            ? { updatedBy: typeof body.updatedBy === "string" ? body.updatedBy.trim() || null : null }
            : {}),
        },
        include: { workshopJob: true },
      });
      if (row.workshopJobId && typeof body.progressPct === "number") {
        await updateWorkshopJob(row.workshopJobId, {
          progressPct: body.progressPct,
          status: body.progressPct >= 100 ? "completed" : "in_progress",
        });
      }
      return row;
    }
    case "delays":
      return prisma.yardDelayEntry.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.delayReason !== undefined ? { delayReason: String(body.delayReason).trim() } : {}),
          ...(body.impactDays !== undefined
            ? { impactDays: typeof body.impactDays === "number" ? body.impactDays : null }
            : {}),
          ...(body.ownerAction !== undefined
            ? { ownerAction: typeof body.ownerAction === "string" ? body.ownerAction.trim() || null : null }
            : {}),
          ...(body.status !== undefined ? { status: body.status as YardRegisterStatus } : {}),
          ...(body.sinceDate !== undefined ? { sinceDate: parseDate(body.sinceDate) ?? null } : {}),
        },
        include: { workshopJob: true },
      });
    case "permits":
      return prisma.yardPermitEntry.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.permitNo !== undefined
            ? { permitNo: typeof body.permitNo === "string" ? body.permitNo.trim() || null : null }
            : {}),
          ...(body.permitType !== undefined ? { permitType: body.permitType as YardPermitType } : {}),
          ...(body.validFrom !== undefined ? { validFrom: parseDate(body.validFrom) ?? null } : {}),
          ...(body.validTo !== undefined ? { validTo: parseDate(body.validTo) ?? null } : {}),
          ...(body.safetyOfficer !== undefined
            ? { safetyOfficer: typeof body.safetyOfficer === "string" ? body.safetyOfficer.trim() || null : null }
            : {}),
          ...(body.status !== undefined ? { status: body.status as YardRegisterStatus } : {}),
        },
        include: { workshopJob: true },
      });
    case "inspections":
      return prisma.yardInspectionEntry.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.holdPoint !== undefined
            ? { holdPoint: typeof body.holdPoint === "string" ? body.holdPoint.trim() || null : null }
            : {}),
          ...(body.inspector !== undefined
            ? { inspector: typeof body.inspector === "string" ? body.inspector.trim() || null : null }
            : {}),
          ...(body.plannedDate !== undefined ? { plannedDate: parseDate(body.plannedDate) ?? null } : {}),
          ...(body.completedDate !== undefined ? { completedDate: parseDate(body.completedDate) ?? null } : {}),
          ...(body.result !== undefined ? { result: body.result as YardInspectionResult } : {}),
          ...(body.classComment !== undefined
            ? { classComment: typeof body.classComment === "string" ? body.classComment.trim() || null : null }
            : {}),
        },
        include: { workshopJob: true },
      });
    case "clarifications":
      return prisma.yardClarification.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.refNo !== undefined
            ? { refNo: typeof body.refNo === "string" ? body.refNo.trim() || null : null }
            : {}),
          ...(body.issueType !== undefined ? { issueType: String(body.issueType).trim() } : {}),
          ...(body.raisedBy !== undefined
            ? { raisedBy: typeof body.raisedBy === "string" ? body.raisedBy.trim() || null : null }
            : {}),
          ...(body.actionBy !== undefined
            ? { actionBy: typeof body.actionBy === "string" ? body.actionBy.trim() || null : null }
            : {}),
          ...(body.body !== undefined ? { body: String(body.body).trim() } : {}),
          ...(body.ownerReply !== undefined
            ? { ownerReply: typeof body.ownerReply === "string" ? body.ownerReply.trim() || null : null }
            : {}),
          ...(body.classComment !== undefined
            ? { classComment: typeof body.classComment === "string" ? body.classComment.trim() || null : null }
            : {}),
          ...(body.internalNotes !== undefined
            ? { internalNotes: typeof body.internalNotes === "string" ? body.internalNotes.trim() || null : null }
            : {}),
          ...(body.status !== undefined ? { status: body.status as YardClarificationStatus } : {}),
        },
        include: { workshopJob: true },
      });
    case "variations":
      return prisma.yardVariationEntry.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.voNumber !== undefined
            ? { voNumber: typeof body.voNumber === "string" ? body.voNumber.trim() || null : null }
            : {}),
          ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
          ...(body.raisedBy !== undefined
            ? { raisedBy: typeof body.raisedBy === "string" ? body.raisedBy.trim() || null : null }
            : {}),
          ...(body.ownerStatus !== undefined ? { ownerStatus: body.ownerStatus as YardRegisterStatus } : {}),
          ...(body.commercialImpact !== undefined
            ? { commercialImpact: typeof body.commercialImpact === "number" ? body.commercialImpact : null }
            : {}),
          ...(body.approved !== undefined ? { approved: body.approved === true } : {}),
        },
        include: { workshopJob: true },
      });
    case "attachments":
      return prisma.yardJobAttachment.update({
        where: { id: entryId },
        data: {
          ...(workshopJobId !== undefined ? { workshopJobId } : {}),
          ...(body.attachmentType !== undefined
            ? { attachmentType: body.attachmentType as YardAttachmentType }
            : {}),
          ...(body.filename !== undefined ? { filename: String(body.filename).trim() } : {}),
          ...(body.fileUrl !== undefined ? { fileUrl: String(body.fileUrl).trim() } : {}),
          ...(body.uploadedBy !== undefined
            ? { uploadedBy: typeof body.uploadedBy === "string" ? body.uploadedBy.trim() || null : null }
            : {}),
          ...(body.visibility !== undefined
            ? { visibility: body.visibility as YardAttachmentVisibility }
            : {}),
          ...(body.notes !== undefined
            ? { notes: typeof body.notes === "string" ? body.notes.trim() || null : null }
            : {}),
        },
        include: { workshopJob: true },
      });
  }
}

export async function deleteYardRegisterEntry(
  registerType: YardRegisterType,
  projectId: string,
  entryId: string,
) {
  const yardWorkProjectId = await resolveYardWorkProjectId(projectId);
  const deletedAt = new Date();

  switch (registerType) {
    case "daily-progress":
      await prisma.yardDailyProgress.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "delays":
      await prisma.yardDelayEntry.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "permits":
      await prisma.yardPermitEntry.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "inspections":
      await prisma.yardInspectionEntry.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "clarifications":
      await prisma.yardClarification.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "variations":
      await prisma.yardVariationEntry.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
    case "attachments":
      await prisma.yardJobAttachment.updateMany({
        where: { id: entryId, yardWorkProjectId, ...notDeleted },
        data: { deletedAt },
      });
      break;
  }
}
