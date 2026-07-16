import type {
  ConditionReportDraft,
  JobDraft,
  LoginResponse,
  MediaQueueItem,
} from "./types";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  if (!payload) {
    throw new Error("Server returned an empty response");
  }

  return payload;
}

export async function mobileLogin(
  baseUrl: string,
  loginId: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  });

  return parseJsonResponse<LoginResponse>(response);
}

export async function syncDraftBatch(args: {
  baseUrl: string;
  authToken: string;
  vesselId: string;
  jobs: JobDraft[];
  reports: ConditionReportDraft[];
}) {
  const response = await fetch(`${normalizeBaseUrl(args.baseUrl)}/api/ship-access/mobile-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.authToken}`,
    },
    body: JSON.stringify({
      vesselId: args.vesselId,
      jobDrafts: args.jobs.map((job) => ({
        localId: job.localId,
        vesselJobId: job.remoteId ?? undefined,
        title: job.title,
        category: job.category,
        department: job.department,
        description: job.description,
        priority: job.priority,
        workshop: job.workshop,
        photoCount: job.photoCount,
        submit: true,
      })),
      conditionReports: args.reports.map((report) => ({
        localId: report.localId,
        machineryAssetId: report.machineryAssetId,
        department: report.department,
        overallRating: report.overallRating,
        summary: report.summary,
        deficiencies: report.deficiencies,
        recommendations: report.recommendations,
      })),
    }),
  });

  return parseJsonResponse<{
    ok: true;
    jobResults: Array<{
      localId: string | null;
      vesselJobId: string | null;
      action: "created" | "updated" | "error";
      error?: string;
    }>;
    conditionResults: Array<{
      localId: string | null;
      reportId: string | null;
      action: "created" | "error";
      error?: string;
    }>;
    summary: {
      jobsCreated: number;
      jobsUpdated: number;
      jobErrors: number;
      conditionReportsCreated: number;
      conditionErrors: number;
    };
  }>(response);
}

export async function uploadQueuedMedia(args: {
  baseUrl: string;
  authToken: string;
  vesselId: string;
  item: MediaQueueItem;
}) {
  const formData = new FormData();
  const fileName = args.item.fileUri.split("/").pop() || `${args.item.localId}.jpg`;

  formData.append("file", {
    uri: args.item.fileUri,
    type: args.item.mimeType || "image/jpeg",
    name: fileName,
  } as unknown as Blob);
  formData.append("entityType", args.item.entityType);
  formData.append("entityId", args.item.entityRemoteId || "");
  formData.append("vesselId", args.vesselId);
  if (args.item.caption) {
    formData.append("caption", args.item.caption);
  }

  const response = await fetch(
    `${normalizeBaseUrl(args.baseUrl)}/api/ship-access/mobile-sync/uploads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.authToken}`,
      },
      body: formData,
    },
  );

  return parseJsonResponse<{ ok: true }>(response);
}

export { normalizeBaseUrl };
