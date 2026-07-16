import type { SQLiteDatabase } from "expo-sqlite";
import type {
  ConditionReportDraft,
  ConditionReportInput,
  DashboardSnapshot,
  JobDraft,
  JobDraftInput,
  MediaQueueItem,
  QueueItem,
  SessionRecord,
  VesselOption,
} from "./types";

const DATABASE_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

export function generateLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const versionRow = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS auth_session (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        base_url TEXT NOT NULL,
        auth_token TEXT NOT NULL,
        login_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role_code TEXT,
        designation TEXT,
        vessel_id TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vessels (
        id TEXT PRIMARY KEY NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS job_drafts (
        local_id TEXT PRIMARY KEY NOT NULL,
        remote_id TEXT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        department TEXT,
        description TEXT,
        priority TEXT,
        workshop TEXT,
        photo_count INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS condition_reports (
        local_id TEXT PRIMARY KEY NOT NULL,
        remote_id TEXT,
        machinery_asset_id TEXT,
        department TEXT,
        overall_rating TEXT NOT NULL,
        summary TEXT,
        deficiencies TEXT,
        recommendations TEXT,
        photo_count INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_queue (
        local_id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_local_id TEXT NOT NULL,
        entity_remote_id TEXT,
        file_uri TEXT NOT NULL,
        caption TEXT,
        mime_type TEXT,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        queue_id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_local_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}

export async function getSession(db: SQLiteDatabase): Promise<SessionRecord | null> {
  const row = await db.getFirstAsync<{
    base_url: string;
    auth_token: string;
    login_id: string;
    display_name: string;
    role_code: string | null;
    designation: string | null;
    vessel_id: string | null;
    updated_at: string;
  }>("SELECT base_url, auth_token, login_id, display_name, role_code, designation, vessel_id, updated_at FROM auth_session WHERE id = 1");

  if (!row) return null;

  return {
    baseUrl: row.base_url,
    authToken: row.auth_token,
    loginId: row.login_id,
    displayName: row.display_name,
    roleCode: row.role_code,
    designation: row.designation,
    vesselId: row.vessel_id,
    updatedAt: row.updated_at,
  };
}

export async function saveSession(
  db: SQLiteDatabase,
  session: Omit<SessionRecord, "updatedAt">,
) {
  const updatedAt = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO auth_session
      (id, base_url, auth_token, login_id, display_name, role_code, designation, vessel_id, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.baseUrl,
      session.authToken,
      session.loginId,
      session.displayName,
      session.roleCode,
      session.designation,
      session.vesselId,
      updatedAt,
    ],
  );
}

export async function clearSession(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM auth_session WHERE id = 1");
}

export async function replaceVessels(db: SQLiteDatabase, vessels: VesselOption[]) {
  await db.runAsync("DELETE FROM vessels");
  for (const vessel of vessels) {
    await db.runAsync(
      "INSERT INTO vessels (id, code, name) VALUES (?, ?, ?)",
      [vessel.id, vessel.code, vessel.name],
    );
  }
}

export async function listVessels(db: SQLiteDatabase): Promise<VesselOption[]> {
  const rows = await db.getAllAsync<{ id: string; code: string; name: string }>(
    "SELECT id, code, name FROM vessels ORDER BY name ASC",
  );
  return rows.map((row) => ({ id: row.id, code: row.code, name: row.name }));
}

async function enqueue(
  db: SQLiteDatabase,
  entityType: QueueItem["entityType"],
  entityLocalId: string,
  operation: QueueItem["operation"],
) {
  const timestamp = nowIso();
  const queueId = `${entityType}:${operation}:${entityLocalId}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue
      (queue_id, entity_type, entity_local_id, operation, status, retry_count, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, NULL, COALESCE((SELECT created_at FROM sync_queue WHERE queue_id = ?), ?), ?)`,
    [queueId, entityType, entityLocalId, operation, queueId, timestamp, timestamp],
  );
}

export async function markQueueSynced(
  db: SQLiteDatabase,
  entityType: QueueItem["entityType"],
  entityLocalId: string,
  operation: QueueItem["operation"],
) {
  const queueId = `${entityType}:${operation}:${entityLocalId}`;
  await db.runAsync(
    "UPDATE sync_queue SET status = 'synced', last_error = NULL, updated_at = ? WHERE queue_id = ?",
    [nowIso(), queueId],
  );
}

export async function markQueueError(
  db: SQLiteDatabase,
  entityType: QueueItem["entityType"],
  entityLocalId: string,
  operation: QueueItem["operation"],
  error: string,
) {
  const queueId = `${entityType}:${operation}:${entityLocalId}`;
  await db.runAsync(
    `UPDATE sync_queue
        SET status = 'error',
            retry_count = retry_count + 1,
            last_error = ?,
            updated_at = ?
      WHERE queue_id = ?`,
    [error, nowIso(), queueId],
  );
}

export async function listQueue(db: SQLiteDatabase): Promise<QueueItem[]> {
  const rows = await db.getAllAsync<{
    queue_id: string;
    entity_type: QueueItem["entityType"];
    entity_local_id: string;
    operation: QueueItem["operation"];
    status: QueueItem["status"];
    retry_count: number;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM sync_queue ORDER BY created_at ASC");

  return rows.map((row) => ({
    queueId: row.queue_id,
    entityType: row.entity_type,
    entityLocalId: row.entity_local_id,
    operation: row.operation,
    status: row.status,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createJobDraft(
  db: SQLiteDatabase,
  input: JobDraftInput,
): Promise<JobDraft> {
  const localId = generateLocalId("job");
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO job_drafts
      (local_id, remote_id, title, category, department, description, priority, workshop, photo_count, sync_status, last_error, created_at, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, 'pending', NULL, ?, ?)`,
    [
      localId,
      input.title.trim(),
      input.category.trim(),
      input.department?.trim() || null,
      input.description?.trim() || null,
      input.priority?.trim() || null,
      input.workshop?.trim() || null,
      timestamp,
      timestamp,
    ],
  );
  await enqueue(db, "vessel_job", localId, "upsert");
  return {
    localId,
    remoteId: null,
    title: input.title.trim(),
    category: input.category.trim(),
    department: input.department?.trim() || null,
    description: input.description?.trim() || null,
    priority: input.priority?.trim() || null,
    workshop: input.workshop?.trim() || null,
    photoCount: 0,
    syncStatus: "pending",
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function createConditionReportDraft(
  db: SQLiteDatabase,
  input: ConditionReportInput,
): Promise<ConditionReportDraft> {
  const localId = generateLocalId("report");
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT INTO condition_reports
      (local_id, remote_id, machinery_asset_id, department, overall_rating, summary, deficiencies, recommendations, photo_count, sync_status, last_error, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, 'pending', NULL, ?)`,
    [
      localId,
      input.machineryAssetId?.trim() || null,
      input.department?.trim() || null,
      input.overallRating,
      input.summary?.trim() || null,
      input.deficiencies?.trim() || null,
      input.recommendations?.trim() || null,
      timestamp,
    ],
  );
  await enqueue(db, "machinery_condition", localId, "upsert");
  return {
    localId,
    remoteId: null,
    machineryAssetId: input.machineryAssetId?.trim() || null,
    department: input.department?.trim() || null,
    overallRating: input.overallRating,
    summary: input.summary?.trim() || null,
    deficiencies: input.deficiencies?.trim() || null,
    recommendations: input.recommendations?.trim() || null,
    photoCount: 0,
    syncStatus: "pending",
    lastError: null,
    createdAt: timestamp,
  };
}

export async function queueMediaUpload(
  db: SQLiteDatabase,
  item: Omit<MediaQueueItem, "createdAt" | "syncStatus" | "lastError" | "entityRemoteId">,
) {
  const createdAt = nowIso();
  await db.runAsync(
    `INSERT INTO media_queue
      (local_id, entity_type, entity_local_id, entity_remote_id, file_uri, caption, mime_type, sync_status, last_error, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, 'pending', NULL, ?)`,
    [
      item.localId,
      item.entityType,
      item.entityLocalId,
      item.fileUri,
      item.caption,
      item.mimeType,
      createdAt,
    ],
  );

  if (item.entityType === "vessel_job") {
    await db.runAsync(
      "UPDATE job_drafts SET photo_count = photo_count + 1, sync_status = 'pending', updated_at = ? WHERE local_id = ?",
      [createdAt, item.entityLocalId],
    );
  } else {
    await db.runAsync(
      "UPDATE condition_reports SET photo_count = photo_count + 1, sync_status = 'pending' WHERE local_id = ?",
      [item.entityLocalId],
    );
  }

  await enqueue(db, "media", item.localId, "upload");
}

export async function listJobDrafts(db: SQLiteDatabase): Promise<JobDraft[]> {
  const rows = await db.getAllAsync<{
    local_id: string;
    remote_id: string | null;
    title: string;
    category: string;
    department: string | null;
    description: string | null;
    priority: string | null;
    workshop: string | null;
    photo_count: number;
    sync_status: JobDraft["syncStatus"];
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM job_drafts ORDER BY updated_at DESC");

  return rows.map((row) => ({
    localId: row.local_id,
    remoteId: row.remote_id,
    title: row.title,
    category: row.category,
    department: row.department,
    description: row.description,
    priority: row.priority,
    workshop: row.workshop,
    photoCount: row.photo_count,
    syncStatus: row.sync_status,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listConditionReports(db: SQLiteDatabase): Promise<ConditionReportDraft[]> {
  const rows = await db.getAllAsync<{
    local_id: string;
    remote_id: string | null;
    machinery_asset_id: string | null;
    department: string | null;
    overall_rating: ConditionReportDraft["overallRating"];
    summary: string | null;
    deficiencies: string | null;
    recommendations: string | null;
    photo_count: number;
    sync_status: ConditionReportDraft["syncStatus"];
    last_error: string | null;
    created_at: string;
  }>("SELECT * FROM condition_reports ORDER BY created_at DESC");

  return rows.map((row) => ({
    localId: row.local_id,
    remoteId: row.remote_id,
    machineryAssetId: row.machinery_asset_id,
    department: row.department,
    overallRating: row.overall_rating,
    summary: row.summary,
    deficiencies: row.deficiencies,
    recommendations: row.recommendations,
    photoCount: row.photo_count,
    syncStatus: row.sync_status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

export async function listMediaQueue(db: SQLiteDatabase): Promise<MediaQueueItem[]> {
  const rows = await db.getAllAsync<{
    local_id: string;
    entity_type: MediaQueueItem["entityType"];
    entity_local_id: string;
    entity_remote_id: string | null;
    file_uri: string;
    caption: string | null;
    mime_type: string | null;
    sync_status: MediaQueueItem["syncStatus"];
    last_error: string | null;
    created_at: string;
  }>("SELECT * FROM media_queue ORDER BY created_at DESC");

  return rows.map((row) => ({
    localId: row.local_id,
    entityType: row.entity_type,
    entityLocalId: row.entity_local_id,
    entityRemoteId: row.entity_remote_id,
    fileUri: row.file_uri,
    caption: row.caption,
    mimeType: row.mime_type,
    syncStatus: row.sync_status,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

export async function markJobDraftSynced(
  db: SQLiteDatabase,
  localId: string,
  remoteId: string,
) {
  await db.runAsync(
    "UPDATE job_drafts SET remote_id = ?, sync_status = 'synced', last_error = NULL, updated_at = ? WHERE local_id = ?",
    [remoteId, nowIso(), localId],
  );
  await markQueueSynced(db, "vessel_job", localId, "upsert");
  await db.runAsync(
    "UPDATE media_queue SET entity_remote_id = ? WHERE entity_type = 'vessel_job' AND entity_local_id = ? AND entity_remote_id IS NULL",
    [remoteId, localId],
  );
}

export async function markJobDraftError(
  db: SQLiteDatabase,
  localId: string,
  error: string,
) {
  await db.runAsync(
    "UPDATE job_drafts SET sync_status = 'error', last_error = ?, updated_at = ? WHERE local_id = ?",
    [error, nowIso(), localId],
  );
  await markQueueError(db, "vessel_job", localId, "upsert", error);
}

export async function markConditionReportSynced(
  db: SQLiteDatabase,
  localId: string,
  remoteId: string,
) {
  await db.runAsync(
    "UPDATE condition_reports SET remote_id = ?, sync_status = 'synced', last_error = NULL WHERE local_id = ?",
    [remoteId, localId],
  );
  await markQueueSynced(db, "machinery_condition", localId, "upsert");
  await db.runAsync(
    "UPDATE media_queue SET entity_remote_id = ? WHERE entity_type = 'machinery_condition' AND entity_local_id = ? AND entity_remote_id IS NULL",
    [remoteId, localId],
  );
}

export async function markConditionReportError(
  db: SQLiteDatabase,
  localId: string,
  error: string,
) {
  await db.runAsync(
    "UPDATE condition_reports SET sync_status = 'error', last_error = ? WHERE local_id = ?",
    [error, localId],
  );
  await markQueueError(db, "machinery_condition", localId, "upsert", error);
}

export async function markMediaSynced(db: SQLiteDatabase, localId: string) {
  await db.runAsync(
    "UPDATE media_queue SET sync_status = 'synced', last_error = NULL WHERE local_id = ?",
    [localId],
  );
  await markQueueSynced(db, "media", localId, "upload");
}

export async function markMediaError(
  db: SQLiteDatabase,
  localId: string,
  error: string,
) {
  await db.runAsync(
    "UPDATE media_queue SET sync_status = 'error', last_error = ? WHERE local_id = ?",
    [error, localId],
  );
  await markQueueError(db, "media", localId, "upload", error);
}

export async function getDashboardSnapshot(
  db: SQLiteDatabase,
): Promise<DashboardSnapshot> {
  const [session, vessels, jobs, reports, media, queue] = await Promise.all([
    getSession(db),
    listVessels(db),
    listJobDrafts(db),
    listConditionReports(db),
    listMediaQueue(db),
    listQueue(db),
  ]);

  return { session, vessels, jobs, reports, media, queue };
}
