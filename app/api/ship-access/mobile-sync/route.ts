import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireMobileShipAccessContext } from "@/lib/auth/mobileShipAccess";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import { createConditionReport } from "@/lib/db/vesselMachineryAssets";
import {
  createDdVesselJob,
  getDdVesselJob,
  resolveVesselIdFromProject,
  updateDdVesselJob,
} from "@/lib/db/superintendent/vesselJobs";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";
import { isJobCategoryAllowedForCrew } from "@/lib/shipAccess/crewJobCategories";
import {
  assertShipVesselInScope,
  getSelectedShipVesselId,
} from "@/lib/shipAccess/scope";
import {
  ddVesselJobCreateSchema,
  vesselConditionRatingSchema,
} from "@/lib/superintendent/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mobileJobSchema = ddVesselJobCreateSchema.omit({ vesselId: true }).extend({
  vesselJobId: z.string().optional(),
  localId: z.string().optional(),
});

const conditionReportSchema = z.object({
  localId: z.string().optional(),
  machineryAssetId: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  overallRating: vesselConditionRatingSchema,
  summary: z.string().nullable().optional(),
  deficiencies: z.string().nullable().optional(),
  recommendations: z.string().nullable().optional(),
});

const syncSchema = z.object({
  vesselId: z.string().optional(),
  jobDrafts: z.array(mobileJobSchema).default([]),
  conditionReports: z.array(conditionReportSchema).default([]),
});

function toDateOrNull(value: string | Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return value instanceof Date ? value : new Date(value);
}

function buildJobWriteInput(input: z.infer<typeof mobileJobSchema>) {
  const {
    submit,
    lastOverhaulDate,
    measurements,
    formData,
    ...rawRest
  } = input;
  const rest = { ...rawRest };
  delete rest.vesselJobId;
  delete rest.localId;

  return {
    ...rest,
    lastOverhaulDate: toDateOrNull(lastOverhaulDate),
    measurements: (measurements ?? undefined) as Prisma.InputJsonValue | undefined,
    formData: (formData ?? undefined) as Prisma.InputJsonValue | undefined,
    status: submit ? "submitted" : (rest.status ?? undefined),
  };
}

export async function GET(request: Request) {
  const mobileAuth = await requireMobileShipAccessContext(request);
  if (!mobileAuth.ok) {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;
  }

  return NextResponse.json({
    version: 1,
    mode: "ship_access_mobile_sync",
    supports: {
      installableWebShell: true,
      batchJobUpserts: true,
      machineryConditionReports: true,
      deferredMediaUploads: true,
      sqliteFirstClientSupported: true,
    },
    endpoints: {
      sync: "/api/ship-access/mobile-sync",
      uploads: "/api/ship-access/mobile-sync/uploads",
    },
    notes: [
      "Store data locally on the mobile device first, then POST batches when online.",
      "Upload images separately to the uploads endpoint after the related job/report has synced.",
      "This contract is designed for a future native mobile client using local SQLite.",
    ],
  });
}

export async function POST(request: Request) {
  const mobileAuth = await requireMobileShipAccessContext(request);
  if (!mobileAuth.ok) {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;
  }

  const parsed = syncSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sync payload" },
      { status: 400 },
    );
  }

  const vesselId = parsed.data.vesselId ?? (await getSelectedShipVesselId());
  if (!vesselId) {
    return NextResponse.json({ error: "No vessel in scope" }, { status: 400 });
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

  const crew = mobileAuth.ok
    ? {
        isVesselCrew: true,
        roleCode: mobileAuth.context.roleCode,
        roleName: mobileAuth.context.roleName,
        designation: mobileAuth.context.designation,
        vesselLoginId: mobileAuth.context.vesselLoginId,
      }
    : await getCrewSessionContext();
  const actorName =
    crew?.designation ?? crew?.roleName ?? crew?.vesselLoginId ?? "Mobile crew sync";

  const jobResults: Array<{
    localId: string | null;
    vesselJobId: string | null;
    action: "created" | "updated" | "error";
    error?: string;
  }> = [];

  for (const draft of parsed.data.jobDrafts) {
    if (
      crew?.isVesselCrew &&
      !isJobCategoryAllowedForCrew(crew.roleCode, draft.category)
    ) {
      jobResults.push({
        localId: draft.localId ?? null,
        vesselJobId: draft.vesselJobId ?? null,
        action: "error",
        error: "Your rank cannot sync jobs in this category",
      });
      continue;
    }

    try {
      if (draft.vesselJobId) {
        const existing = await getDdVesselJob(draft.vesselJobId);
        if (!existing) {
          jobResults.push({
            localId: draft.localId ?? null,
            vesselJobId: draft.vesselJobId,
            action: "error",
            error: "Existing job not found",
          });
          continue;
        }
        if (existing.vesselId !== vesselId) {
          jobResults.push({
            localId: draft.localId ?? null,
            vesselJobId: draft.vesselJobId,
            action: "error",
            error: "Job does not belong to the vessel in scope",
          });
          continue;
        }

        const vesselJob = await updateDdVesselJob(draft.vesselJobId, buildJobWriteInput(draft));
        jobResults.push({
          localId: draft.localId ?? null,
          vesselJobId: vesselJob.id,
          action: "updated",
        });
        continue;
      }

      let resolvedVesselId = vesselId;
      if (draft.targetDryDockProjectId) {
        const projectVesselId = await resolveVesselIdFromProject(draft.targetDryDockProjectId);
        if (!projectVesselId) {
          jobResults.push({
            localId: draft.localId ?? null,
            vesselJobId: null,
            action: "error",
            error: "Target dry dock project not found",
          });
          continue;
        }
        resolvedVesselId = projectVesselId;
      }

      const vesselJob = await createDdVesselJob({
        vesselId: resolvedVesselId,
        ...buildJobWriteInput(draft),
        createdByName: draft.createdByName ?? actorName,
        createdByRole: "vessel",
      });

      jobResults.push({
        localId: draft.localId ?? null,
        vesselJobId: vesselJob.id,
        action: "created",
      });
    } catch (error) {
      jobResults.push({
        localId: draft.localId ?? null,
        vesselJobId: draft.vesselJobId ?? null,
        action: "error",
        error: error instanceof Error ? error.message : "Failed to sync job",
      });
    }
  }

  const conditionResults: Array<{
    localId: string | null;
    reportId: string | null;
    action: "created" | "error";
    error?: string;
  }> = [];

  for (const report of parsed.data.conditionReports) {
    try {
      const created = await createConditionReport({
        vesselId,
        machineryAssetId: report.machineryAssetId ?? null,
        department: report.department ?? null,
        overallRating: report.overallRating,
        summary: report.summary ?? null,
        deficiencies: report.deficiencies ?? null,
        recommendations: report.recommendations ?? null,
        reportedBy: actorName,
      });

      conditionResults.push({
        localId: report.localId ?? null,
        reportId: created.id,
        action: "created",
      });
    } catch (error) {
      conditionResults.push({
        localId: report.localId ?? null,
        reportId: null,
        action: "error",
        error: error instanceof Error ? error.message : "Failed to sync condition report",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    vesselId,
    jobResults,
    conditionResults,
    summary: {
      jobsCreated: jobResults.filter((item) => item.action === "created").length,
      jobsUpdated: jobResults.filter((item) => item.action === "updated").length,
      jobErrors: jobResults.filter((item) => item.action === "error").length,
      conditionReportsCreated: conditionResults.filter((item) => item.action === "created").length,
      conditionErrors: conditionResults.filter((item) => item.action === "error").length,
    },
  });
}
