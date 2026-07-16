import { StatusBar } from "expo-status-bar";
import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDbIfNeeded } from "./src/data";
import { useActiniumMobile } from "./src/useActiniumMobile";
import type { ConditionReportDraft, JobDraft, QueueItem } from "./src/types";

type TabKey = "overview" | "jobs" | "machinery" | "queue";

const JOB_CATEGORIES = ["Hull", "Machinery", "Electrical", "Safety", "Cargo"];
const RATINGS: Array<ConditionReportDraft["overallRating"]> = [
  "excellent",
  "good",
  "monitor",
  "poor",
  "critical",
];

export default function App() {
  return (
    <SQLiteProvider databaseName="actinium_mobile.db" onInit={migrateDbIfNeeded}>
      <ActiniumMobileApp />
    </SQLiteProvider>
  );
}

function ActiniumMobileApp() {
  const mobile = useActiniumMobile();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [jobCategory, setJobCategory] = useState("Machinery");
  const [jobDepartment, setJobDepartment] = useState("");
  const [jobPriority, setJobPriority] = useState("medium");
  const [jobWorkshop, setJobWorkshop] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [reportDepartment, setReportDepartment] = useState("");
  const [reportAssetId, setReportAssetId] = useState("");
  const [reportRating, setReportRating] =
    useState<ConditionReportDraft["overallRating"]>("good");
  const [reportSummary, setReportSummary] = useState("");
  const [reportDeficiencies, setReportDeficiencies] = useState("");
  const [reportRecommendations, setReportRecommendations] = useState("");

  const selectedVessel = useMemo(() => {
    const vesselId = mobile.snapshot?.session?.vesselId;
    return mobile.snapshot?.vessels.find((item) => item.id === vesselId) ?? null;
  }, [mobile.snapshot?.session?.vesselId, mobile.snapshot?.vessels]);

  const pendingMedia = mobile.snapshot?.media.filter((item) => item.syncStatus !== "synced") ?? [];

  if (mobile.loading || !mobile.snapshot) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.helperText}>Preparing offline workspace…</Text>
        <StatusBar style="dark" />
      </View>
    );
  }

  async function handleLogin() {
    try {
      await mobile.signIn(baseUrl, loginId, password);
      setPassword("");
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Unable to sign in");
    }
  }

  async function handleAddJob() {
    try {
      await mobile.addJobDraft({
        title: jobTitle,
        category: jobCategory,
        department: jobDepartment,
        priority: jobPriority,
        workshop: jobWorkshop,
        description: jobDescription,
      });
      setJobTitle("");
      setJobDepartment("");
      setJobWorkshop("");
      setJobDescription("");
    } catch (error) {
      Alert.alert("Job not saved", error instanceof Error ? error.message : "Please check the form");
    }
  }

  async function handleAddReport() {
    try {
      await mobile.addConditionReport({
        department: reportDepartment,
        machineryAssetId: reportAssetId,
        overallRating: reportRating,
        summary: reportSummary,
        deficiencies: reportDeficiencies,
        recommendations: reportRecommendations,
      });
      setReportDepartment("");
      setReportAssetId("");
      setReportSummary("");
      setReportDeficiencies("");
      setReportRecommendations("");
      setReportRating("good");
    } catch (error) {
      Alert.alert("Report not saved", error instanceof Error ? error.message : "Please check the form");
    }
  }

  async function handleSync() {
    try {
      await mobile.syncNow("manual");
    } catch (error) {
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Unable to sync");
    }
  }

  if (!mobile.snapshot.session) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <Text style={styles.brand}>Actinium DD Mobile</Text>
          <Text style={styles.subtitle}>
            Android-first vessel app with local SQLite storage, image capture, and sync queue.
          </Text>

          <Field label="Platform URL">
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.20:3000"
              style={styles.input}
            />
          </Field>
          <Field label="Login ID">
            <TextInput
              value={loginId}
              onChangeText={setLoginId}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="AAA-BBB-CE01"
              style={styles.input}
            />
          </Field>
          <Field label="Password">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              style={styles.input}
            />
          </Field>

          <Pressable style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>

          <Text style={styles.helperText}>
            Use the platform LAN URL on Android devices. `localhost` only works on the same machine.
          </Text>
        </ScrollView>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome, {mobile.snapshot.session.displayName}</Text>
          <Text style={styles.helperText}>
            {selectedVessel ? `${selectedVessel.code} • ${selectedVessel.name}` : "No vessel selected"}
          </Text>
        </View>
        <Pressable style={styles.syncButton} onPress={handleSync}>
          <Text style={styles.syncButtonText}>{mobile.isSyncing ? "Syncing…" : "Sync Now"}</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label={mobile.isOnline ? "Online" : "Offline"} tone={mobile.isOnline ? "good" : "warn"} />
        <StatusPill label={`${mobile.stats.pending} pending`} tone="warn" />
        <StatusPill label={`${mobile.stats.failed} failed`} tone={mobile.stats.failed > 0 ? "danger" : "neutral"} />
      </View>

      <View style={styles.tabRow}>
        {(["overview", "jobs", "machinery", "queue"] as TabKey[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabButton, activeTab === tab ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabButtonText, activeTab === tab ? styles.tabButtonTextActive : null]}>
              {tab === "overview" ? "Overview" : tab === "jobs" ? "Jobs" : tab === "machinery" ? "Machinery" : "Queue"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "overview" ? (
          <>
            <Card title="Session">
              <InfoRow label="Login" value={mobile.snapshot.session.loginId} />
              <InfoRow label="Role" value={mobile.snapshot.session.roleCode || "Crew"} />
              <InfoRow label="Designation" value={mobile.snapshot.session.designation || "Not set"} />
              <InfoRow label="Server" value={mobile.snapshot.session.baseUrl} />
              <Text style={styles.sectionHint}>{mobile.syncMessage || "Offline changes stay on device until sync succeeds."}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => mobile.signOut()}>
                <Text style={styles.secondaryButtonText}>Sign Out</Text>
              </Pressable>
            </Card>

            <Card title="Vessel Scope">
              {mobile.snapshot.vessels.map((vessel) => (
                <Pressable
                  key={vessel.id}
                  style={[
                    styles.selectCard,
                    mobile.snapshot?.session?.vesselId === vessel.id ? styles.selectCardActive : null,
                  ]}
                  onPress={() => mobile.selectVessel(vessel.id)}
                >
                  <Text style={styles.selectCardTitle}>{vessel.code}</Text>
                  <Text style={styles.helperText}>{vessel.name}</Text>
                </Pressable>
              ))}
            </Card>

            <Card title="Queue Snapshot">
              <InfoRow label="Job drafts" value={String(mobile.snapshot.jobs.length)} />
              <InfoRow label="Condition reports" value={String(mobile.snapshot.reports.length)} />
              <InfoRow label="Pending media" value={String(pendingMedia.length)} />
              <InfoRow label="Synced queue items" value={String(mobile.stats.synced)} />
            </Card>
          </>
        ) : null}

        {activeTab === "jobs" ? (
          <>
            <Card title="New Vessel Job">
              <Field label="Title">
                <TextInput value={jobTitle} onChangeText={setJobTitle} placeholder="Main engine cooling pump overhaul" style={styles.input} />
              </Field>
              <Field label="Category">
                <View style={styles.choiceWrap}>
                  {JOB_CATEGORIES.map((category) => (
                    <ChoiceChip key={category} active={jobCategory === category} onPress={() => setJobCategory(category)} label={category} />
                  ))}
                </View>
              </Field>
              <Field label="Department">
                <TextInput value={jobDepartment} onChangeText={setJobDepartment} placeholder="Engine" style={styles.input} />
              </Field>
              <Field label="Priority">
                <TextInput value={jobPriority} onChangeText={setJobPriority} placeholder="medium" style={styles.input} />
              </Field>
              <Field label="Workshop">
                <TextInput value={jobWorkshop} onChangeText={setJobWorkshop} placeholder="ME workshop" style={styles.input} />
              </Field>
              <Field label="Description">
                <TextInput
                  value={jobDescription}
                  onChangeText={setJobDescription}
                  placeholder="Observed leakage and abnormal vibration."
                  multiline
                  style={[styles.input, styles.textArea]}
                />
              </Field>
              <Pressable style={styles.primaryButton} onPress={handleAddJob}>
                <Text style={styles.primaryButtonText}>Save Job Offline</Text>
              </Pressable>
            </Card>

            <Card title="Saved Jobs">
              {mobile.snapshot.jobs.length === 0 ? (
                <Text style={styles.helperText}>No job drafts saved yet.</Text>
              ) : (
                mobile.snapshot.jobs.map((job) => (
                  <JobCard
                    key={job.localId}
                    job={job}
                    onCapture={() => mobile.captureMedia("vessel_job", job.localId, `Progress photo for ${job.title}`)}
                  />
                ))
              )}
            </Card>
          </>
        ) : null}

        {activeTab === "machinery" ? (
          <>
            <Card title="New Machinery Condition Report">
              <Field label="Overall Rating">
                <View style={styles.choiceWrap}>
                  {RATINGS.map((rating) => (
                    <ChoiceChip key={rating} active={reportRating === rating} onPress={() => setReportRating(rating)} label={rating} />
                  ))}
                </View>
              </Field>
              <Field label="Department">
                <TextInput value={reportDepartment} onChangeText={setReportDepartment} placeholder="Engine" style={styles.input} />
              </Field>
              <Field label="Machinery Asset ID">
                <TextInput value={reportAssetId} onChangeText={setReportAssetId} placeholder="asset-123" style={styles.input} />
              </Field>
              <Field label="Summary">
                <TextInput value={reportSummary} onChangeText={setReportSummary} placeholder="Running within expected range." style={[styles.input, styles.textArea]} multiline />
              </Field>
              <Field label="Deficiencies">
                <TextInput value={reportDeficiencies} onChangeText={setReportDeficiencies} placeholder="Minor gasket seepage." style={[styles.input, styles.textArea]} multiline />
              </Field>
              <Field label="Recommendations">
                <TextInput value={reportRecommendations} onChangeText={setReportRecommendations} placeholder="Inspect during next planned stop." style={[styles.input, styles.textArea]} multiline />
              </Field>
              <Pressable style={styles.primaryButton} onPress={handleAddReport}>
                <Text style={styles.primaryButtonText}>Save Report Offline</Text>
              </Pressable>
            </Card>

            <Card title="Saved Condition Reports">
              {mobile.snapshot.reports.length === 0 ? (
                <Text style={styles.helperText}>No condition reports saved yet.</Text>
              ) : (
                mobile.snapshot.reports.map((report) => (
                  <ReportCard
                    key={report.localId}
                    report={report}
                    onCapture={() =>
                      mobile.captureMedia("machinery_condition", report.localId, "Machinery condition photo")
                    }
                  />
                ))
              )}
            </Card>
          </>
        ) : null}

        {activeTab === "queue" ? (
          <>
            <Card title="Sync Queue">
              {mobile.snapshot.queue.length === 0 ? (
                <Text style={styles.helperText}>Queue is empty.</Text>
              ) : (
                mobile.snapshot.queue.map((item) => <QueueCard key={item.queueId} item={item} />)
              )}
            </Card>
            <Card title="Pending Media Uploads">
              {pendingMedia.length === 0 ? (
                <Text style={styles.helperText}>No pending image uploads.</Text>
              ) : (
                pendingMedia.map((item) => (
                  <View key={item.localId} style={styles.queueRow}>
                    <Text style={styles.queueTitle}>{item.entityType.replace("_", " ")}</Text>
                    <Text style={styles.helperText}>{item.caption || item.fileUri.split("/").pop()}</Text>
                    <Text style={styles.helperText}>Status: {item.syncStatus}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      {props.children}
    </View>
  );
}

function Card(props: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function StatusPill(props: { label: string; tone: "good" | "warn" | "danger" | "neutral" }) {
  return (
    <View
      style={[
        styles.pill,
        props.tone === "good"
          ? styles.pillGood
          : props.tone === "warn"
            ? styles.pillWarn
            : props.tone === "danger"
              ? styles.pillDanger
              : styles.pillNeutral,
      ]}
    >
      <Text style={styles.pillText}>{props.label}</Text>
    </View>
  );
}

function ChoiceChip(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.choiceChip, props.active ? styles.choiceChipActive : null]}
      onPress={props.onPress}
    >
      <Text style={[styles.choiceChipText, props.active ? styles.choiceChipTextActive : null]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function InfoRow(props: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{props.label}</Text>
      <Text style={styles.infoValue}>{props.value}</Text>
    </View>
  );
}

function JobCard(props: { job: JobDraft; onCapture: () => void }) {
  return (
    <View style={styles.queueRow}>
      <Text style={styles.queueTitle}>{props.job.title}</Text>
      <Text style={styles.helperText}>
        {props.job.category} • {props.job.department || "No department"} • Photos {props.job.photoCount}
      </Text>
      <Text style={styles.helperText}>Sync: {props.job.syncStatus}{props.job.lastError ? ` • ${props.job.lastError}` : ""}</Text>
      <Pressable style={styles.secondaryButton} onPress={props.onCapture}>
        <Text style={styles.secondaryButtonText}>Capture Progress Photo</Text>
      </Pressable>
    </View>
  );
}

function ReportCard(props: { report: ConditionReportDraft; onCapture: () => void }) {
  return (
    <View style={styles.queueRow}>
      <Text style={styles.queueTitle}>{props.report.department || "General machinery"}</Text>
      <Text style={styles.helperText}>
        Rating {props.report.overallRating} • Photos {props.report.photoCount}
      </Text>
      <Text style={styles.helperText}>
        Sync: {props.report.syncStatus}
        {props.report.lastError ? ` • ${props.report.lastError}` : ""}
      </Text>
      <Pressable style={styles.secondaryButton} onPress={props.onCapture}>
        <Text style={styles.secondaryButtonText}>Capture Machinery Photo</Text>
      </Pressable>
    </View>
  );
}

function QueueCard(props: { item: QueueItem }) {
  return (
    <View style={styles.queueRow}>
      <Text style={styles.queueTitle}>
        {props.item.entityType} • {props.item.operation}
      </Text>
      <Text style={styles.helperText}>
        Status {props.item.status} • retries {props.item.retryCount}
      </Text>
      {props.item.lastError ? <Text style={styles.errorText}>{props.item.lastError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    gap: 12,
  },
  loginContainer: {
    padding: 24,
    gap: 16,
  },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  helperText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillGood: {
    backgroundColor: "#dcfce7",
  },
  pillWarn: {
    backgroundColor: "#fef3c7",
  },
  pillDanger: {
    backgroundColor: "#fee2e2",
  },
  pillNeutral: {
    backgroundColor: "#e2e8f0",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  tabButtonActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#60a5fa",
  },
  tabButtonText: {
    color: "#334155",
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#1d4ed8",
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#1d4ed8",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  syncButton: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  syncButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  infoValue: {
    color: "#0f172a",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  sectionHint: {
    color: "#475569",
    lineHeight: 20,
  },
  selectCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff",
  },
  selectCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  selectCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceChipActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#60a5fa",
  },
  choiceChipText: {
    color: "#334155",
    fontWeight: "600",
  },
  choiceChipTextActive: {
    color: "#1d4ed8",
  },
  queueRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  queueTitle: {
    fontWeight: "700",
    color: "#0f172a",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    lineHeight: 18,
  },
});
