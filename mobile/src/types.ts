export type VesselOption = {
  id: string;
  code: string;
  name: string;
};

export type SessionRecord = {
  baseUrl: string;
  authToken: string;
  loginId: string;
  displayName: string;
  roleCode: string | null;
  designation: string | null;
  vesselId: string | null;
  updatedAt: string;
};

export type JobDraft = {
  localId: string;
  remoteId: string | null;
  title: string;
  category: string;
  department: string | null;
  description: string | null;
  priority: string | null;
  workshop: string | null;
  photoCount: number;
  syncStatus: "pending" | "synced" | "error";
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConditionReportDraft = {
  localId: string;
  remoteId: string | null;
  machineryAssetId: string | null;
  department: string | null;
  overallRating: "excellent" | "good" | "monitor" | "poor" | "critical";
  summary: string | null;
  deficiencies: string | null;
  recommendations: string | null;
  photoCount: number;
  syncStatus: "pending" | "synced" | "error";
  lastError: string | null;
  createdAt: string;
};

export type MediaQueueItem = {
  localId: string;
  entityType: "vessel_job" | "machinery_condition";
  entityLocalId: string;
  entityRemoteId: string | null;
  fileUri: string;
  caption: string | null;
  mimeType: string | null;
  syncStatus: "pending" | "synced" | "error";
  lastError: string | null;
  createdAt: string;
};

export type QueueItem = {
  queueId: string;
  entityType: "vessel_job" | "machinery_condition" | "media";
  entityLocalId: string;
  operation: "upsert" | "upload";
  status: "pending" | "synced" | "error";
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  ok: true;
  token: string;
  user: {
    loginId: string;
    displayName: string;
    employeeCode: string;
    roleCode: string | null;
    designation: string | null;
    vesselLoginId: string | null;
  };
  vessels: VesselOption[];
  defaultVesselId: string | null;
};

export type JobDraftInput = {
  title: string;
  category: string;
  department?: string;
  description?: string;
  priority?: string;
  workshop?: string;
};

export type ConditionReportInput = {
  machineryAssetId?: string;
  department?: string;
  overallRating: ConditionReportDraft["overallRating"];
  summary?: string;
  deficiencies?: string;
  recommendations?: string;
};

export type DashboardSnapshot = {
  session: SessionRecord | null;
  vessels: VesselOption[];
  jobs: JobDraft[];
  reports: ConditionReportDraft[];
  media: MediaQueueItem[];
  queue: QueueItem[];
};
