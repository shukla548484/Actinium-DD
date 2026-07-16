import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as ImagePicker from "expo-image-picker";
import { useNetInfo } from "@react-native-community/netinfo";
import { mobileLogin, syncDraftBatch, uploadQueuedMedia } from "./api";
import {
  clearSession,
  createConditionReportDraft,
  createJobDraft,
  generateLocalId,
  getDashboardSnapshot,
  listMediaQueue,
  markConditionReportError,
  markConditionReportSynced,
  markJobDraftError,
  markJobDraftSynced,
  markMediaError,
  markMediaSynced,
  queueMediaUpload,
  replaceVessels,
  saveSession,
} from "./data";
import type {
  ConditionReportInput,
  DashboardSnapshot,
  JobDraftInput,
} from "./types";

export function useActiniumMobile() {
  const db = useSQLiteContext();
  const netInfo = useNetInfo();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getDashboardSnapshot(db);
    setSnapshot(next);
    return next;
  }, [db]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (baseUrl: string, loginId: string, password: string) => {
      const result = await mobileLogin(baseUrl, loginId, password);
      const selectedVesselId = result.defaultVesselId ?? result.vessels[0]?.id ?? null;

      await saveSession(db, {
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
        authToken: result.token,
        loginId: result.user.loginId,
        displayName: result.user.displayName,
        roleCode: result.user.roleCode,
        designation: result.user.designation,
        vesselId: selectedVesselId,
      });
      await replaceVessels(db, result.vessels);
      await refresh();
    },
    [db, refresh],
  );

  const signOut = useCallback(async () => {
    await clearSession(db);
    await refresh();
  }, [db, refresh]);

  const selectVessel = useCallback(
    async (vesselId: string) => {
      if (!snapshot?.session) return;
      await saveSession(db, {
        ...snapshot.session,
        vesselId,
      });
      await refresh();
    },
    [db, refresh, snapshot?.session],
  );

  const addJobDraft = useCallback(
    async (input: JobDraftInput) => {
      if (!input.title.trim() || !input.category.trim()) {
        throw new Error("Title and category are required.");
      }
      await createJobDraft(db, input);
      await refresh();
    },
    [db, refresh],
  );

  const addConditionReport = useCallback(
    async (input: ConditionReportInput) => {
      await createConditionReportDraft(db, input);
      await refresh();
    },
    [db, refresh],
  );

  const captureMedia = useCallback(
    async (
      entityType: "vessel_job" | "machinery_condition",
      entityLocalId: string,
      caption?: string,
    ) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera permission required", "Please allow camera access to attach progress photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      await queueMediaUpload(db, {
        localId: generateLocalId("media"),
        entityType,
        entityLocalId,
        fileUri: asset.uri,
        caption: caption?.trim() || null,
        mimeType: asset.mimeType || "image/jpeg",
      });
      await refresh();
    },
    [db, refresh],
  );

  const syncNow = useCallback(
    async (mode: "manual" | "background" = "manual") => {
      const current = snapshot ?? (await refresh());
      const session = current.session;
      if (!session?.authToken || !session.vesselId) {
        if (mode === "manual") {
          throw new Error("Sign in and select a vessel before syncing.");
        }
        return;
      }

      if (isSyncing) return;
      setIsSyncing(true);

      try {
        const jobsToSync = current.jobs.filter((item) => item.syncStatus !== "synced");
        const reportsToSync = current.reports.filter((item) => item.syncStatus !== "synced");

        if (jobsToSync.length > 0 || reportsToSync.length > 0) {
          const batchResult = await syncDraftBatch({
            baseUrl: session.baseUrl,
            authToken: session.authToken,
            vesselId: session.vesselId,
            jobs: jobsToSync,
            reports: reportsToSync,
          });

          for (const item of batchResult.jobResults) {
            if (!item.localId) continue;
            if ((item.action === "created" || item.action === "updated") && item.vesselJobId) {
              await markJobDraftSynced(db, item.localId, item.vesselJobId);
            } else if (item.error) {
              await markJobDraftError(db, item.localId, item.error);
            }
          }

          for (const item of batchResult.conditionResults) {
            if (!item.localId) continue;
            if (item.action === "created" && item.reportId) {
              await markConditionReportSynced(db, item.localId, item.reportId);
            } else if (item.error) {
              await markConditionReportError(db, item.localId, item.error);
            }
          }

          if (mode === "manual") {
            setSyncMessage(
              `Synced ${batchResult.summary.jobsCreated + batchResult.summary.jobsUpdated} job updates and ${batchResult.summary.conditionReportsCreated} machinery reports.`,
            );
          }
        }

        const mediaItems = (await listMediaQueue(db)).filter(
          (item) => item.syncStatus !== "synced" && item.entityRemoteId,
        );

        for (const item of mediaItems) {
          try {
            await uploadQueuedMedia({
              baseUrl: session.baseUrl,
              authToken: session.authToken,
              vesselId: session.vesselId,
              item,
            });
            await markMediaSynced(db, item.localId);
          } catch (error) {
            await markMediaError(
              db,
              item.localId,
              error instanceof Error ? error.message : "Failed to upload media",
            );
          }
        }

        await refresh();
      } finally {
        setIsSyncing(false);
      }
    },
    [db, isSyncing, refresh, snapshot],
  );

  useEffect(() => {
    const hasPending = snapshot?.queue.some((item) => item.status !== "synced");
    if (!snapshot?.session?.authToken || !snapshot.session.vesselId || !hasPending) return;
    if (!netInfo.isConnected) return;

    void syncNow("background").catch(() => {
      // Background sync failures are surfaced in per-item status and queue state.
    });
  }, [
    netInfo.isConnected,
    snapshot?.queue,
    snapshot?.session?.authToken,
    snapshot?.session?.vesselId,
    syncNow,
  ]);

  const stats = useMemo(() => {
    const pending = snapshot?.queue.filter((item) => item.status === "pending").length ?? 0;
    const failed = snapshot?.queue.filter((item) => item.status === "error").length ?? 0;
    const synced = snapshot?.queue.filter((item) => item.status === "synced").length ?? 0;
    return { pending, failed, synced };
  }, [snapshot?.queue]);

  return {
    snapshot,
    loading,
    isSyncing,
    isOnline: Boolean(netInfo.isConnected),
    syncMessage,
    stats,
    signIn,
    signOut,
    selectVessel,
    addJobDraft,
    addConditionReport,
    captureMedia,
    syncNow,
    refresh,
  };
}
