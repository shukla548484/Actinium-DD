/**
 * Class Status / Survey Status Report analysis.
 * OpenAI reads the PDF; local extract is compared; survey due dates come from the
 * report survey schedule table (Special / Intermediate / Docking / CSM), not anniversary math.
 */

export type ClassStatusTableRow = {
  id: string;
  ref: string | null;
  title: string;
  dueOrWindow: string | null;
  notes: string | null;
  sourceHint: string | null;
  attend: boolean;
  createdJobId: string | null;
};

export type CapCertificationState = {
  ownersRequireCap: boolean | null;
  notes: string;
  evidenceFromReport: string | null;
};

export type ClassStatusExtractionComparison = {
  localCharCount: number;
  openaiPdfUsed: boolean;
  preferredSource: "openai_pdf" | "local_text" | "merged";
  note: string;
};

export type ClassStatusVesselProfile = {
  vesselName: string | null;
  classificationSociety: string | null;
  classNumber: string | null;
  imoNumber: string | null;
  irNumber: string | null;
  vesselType: string | null;
  grossTonnage: string | null;
  deadweight: string | null;
  portOfRegistry: string | null;
  flag: string | null;
  dateOfBuild: string | null;
  reportGeneratedOn: string | null;
  extra: Record<string, string>;
};

export type ClassStatusParties = {
  registeredOwner: string | null;
  owner: string | null;
  manager: string | null;
  ismManager: string | null;
  invoicingAddress: string | null;
  extra: Record<string, string>;
};

export type ClassStatusCertificate = {
  id: string;
  name: string;
  certificateNumber: string | null;
  issuedDate: string | null;
  issuedPlace: string | null;
  issuedBy: string | null;
  expiryDate: string | null;
  /** Issued date + 1 year — annual verification / endorsement due */
  annualEndorsementDue: string | null;
  requiresAnnualEndorsement: boolean;
  isIopp: boolean;
  notes: string | null;
};

export type ClassStatusSurveyKind =
  | "special_survey"
  | "intermediate_survey"
  | "docking_survey"
  | "continuous_survey_machinery";

export type ClassStatusSurveyScheduleItem = {
  id: string;
  kind: ClassStatusSurveyKind;
  label: string;
  assignedDate: string | null;
  dueDate: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  /** Free-text range when start/end cannot be split cleanly */
  rangeLabel: string | null;
  /** Report status e.g. Due / Overdue / Completed */
  status: string | null;
  source: "openai_pdf" | "local_text" | "merged";
  notes: string | null;
};

export type ClassStatusSurveyPlanning = {
  /** Informational only — IOPP issued date when present; NOT used for SS/IS due dates */
  anniversaryDate: string | null;
  anniversarySource: string | null;
  /** Convenience mirrors of surveys[] (from report schedule, not anniversary math) */
  intermediateSurveyWindowStart: string | null;
  intermediateSurveyWindowEnd: string | null;
  specialSurveyDue: string | null;
  /** Special / Intermediate / Docking / Continuous Survey Machinery from the report */
  surveys: ClassStatusSurveyScheduleItem[];
  notes: string | null;
};

export type ClassMachinerySyncAction =
  | "updated_from_class"
  | "kept_app_record"
  | "new_from_class"
  | "matched_no_change";

export type ClassMachinerySyncMatchBy = "class_code" | "asset_id" | "name" | null;

/** Diff / apply result for one Class machinery line vs vessel register. */
export type ClassMachinerySyncRow = {
  id: string;
  classMachineryId: string;
  machineryAssetId: string | null;
  name: string;
  classCode: string | null;
  matchBy: ClassMachinerySyncMatchBy;
  action: ClassMachinerySyncAction;
  /** User-facing: Updated from Class (newer) / Kept app record / New from Class */
  message: string;
  classLastDone: string | null;
  classDueDate: string | null;
  classStatus: string | null;
  appLastDone: string | null;
  appDueDate: string | null;
  applied: boolean;
};

export type ClassStatusMachineryItem = {
  id: string;
  name: string;
  /** Class / CSM item code when present (e.g. IRS 0024) */
  classCode: string | null;
  lastDone: string | null;
  dueDate: string | null;
  /** Report status e.g. Due / Overdue / Completed / Pending */
  status: string | null;
  /** Due within dry-dock window or within 1 year from report / today */
  includeInDryDock: boolean;
  reason: string | null;
  attend: boolean;
  createdJobId: string | null;
  /** Linked vessel machinery asset after sync */
  machineryAssetId: string | null;
};

export type ClassStatusConditionItem = {
  id: string;
  kind: "coc" | "statutory" | "memorandum" | "additional" | "due_or_overdue";
  ref: string | null;
  title: string;
  dueOrWindow: string | null;
  notes: string | null;
  attend: boolean;
  createdJobId: string | null;
};

export type ClassStatusAnalysis = {
  version: 3;
  sourceAttachmentId: string | null;
  sourceFileName: string | null;
  analyzedAt: string;
  model: string | null;
  vessel: ClassStatusVesselProfile;
  parties: ClassStatusParties;
  certificates: ClassStatusCertificate[];
  surveyPlanning: ClassStatusSurveyPlanning;
  conditions: ClassStatusConditionItem[];
  machinery: ClassStatusMachineryItem[];
  /** Re-upload sync vs vessel machinery register */
  machinerySync: ClassMachinerySyncRow[];
  /** Tickable dry-dock jobs (surveys due, machinery, recommendations) */
  jobs: ClassStatusTableRow[];
  cocs: ClassStatusTableRow[];
  otherItems: ClassStatusTableRow[];
  capCertification: CapCertificationState;
  rawSummary: string | null;
  extractionComparison?: ClassStatusExtractionComparison | null;
  /** Index / contents notes from report */
  reportIndexNotes: string | null;
};

type ClassStatusAnalysisV2 = {
  version: 2;
  sourceAttachmentId?: string | null;
  sourceFileName?: string | null;
  analyzedAt?: string;
  model?: string | null;
  jobs?: ClassStatusTableRow[];
  cocs?: ClassStatusTableRow[];
  otherItems?: ClassStatusTableRow[];
  capCertification?: CapCertificationState;
  rawSummary?: string | null;
  extractionComparison?: ClassStatusExtractionComparison | null;
};

type ClassStatusAnalysisV1 = {
  version: 1;
  sourceAttachmentId?: string | null;
  sourceFileName?: string | null;
  analyzedAt?: string;
  model?: string | null;
  dueJobs?: Array<{ id: string; text: string; sourceHint?: string | null; confirmed: boolean }>;
  recommendations?: Array<{ id: string; text: string; sourceHint?: string | null; confirmed: boolean }>;
  cocs?: Array<{ id: string; text: string; sourceHint?: string | null; confirmed: boolean }>;
  specialCertifications?: Array<{
    id: string;
    text: string;
    sourceHint?: string | null;
    confirmed: boolean;
  }>;
  capCertification?: CapCertificationState;
  rawSummary?: string | null;
};

function emptyVessel(): ClassStatusVesselProfile {
  return {
    vesselName: null,
    classificationSociety: null,
    classNumber: null,
    imoNumber: null,
    irNumber: null,
    vesselType: null,
    grossTonnage: null,
    deadweight: null,
    portOfRegistry: null,
    flag: null,
    dateOfBuild: null,
    reportGeneratedOn: null,
    extra: {},
  };
}

function emptyParties(): ClassStatusParties {
  return {
    registeredOwner: null,
    owner: null,
    manager: null,
    ismManager: null,
    invoicingAddress: null,
    extra: {},
  };
}

function emptySurveyPlanning(): ClassStatusSurveyPlanning {
  return {
    anniversaryDate: null,
    anniversarySource: null,
    intermediateSurveyWindowStart: null,
    intermediateSurveyWindowEnd: null,
    specialSurveyDue: null,
    surveys: [],
    notes: null,
  };
}

export function emptyClassStatusAnalysis(
  partial?: Partial<ClassStatusAnalysis>,
): ClassStatusAnalysis {
  const { version: _v, ...rest } = partial ?? {};
  return {
    version: 3,
    sourceAttachmentId: null,
    sourceFileName: null,
    analyzedAt: new Date().toISOString(),
    model: null,
    vessel: emptyVessel(),
    parties: emptyParties(),
    certificates: [],
    surveyPlanning: emptySurveyPlanning(),
    conditions: [],
    machinery: [],
    machinerySync: [],
    jobs: [],
    cocs: [],
    otherItems: [],
    capCertification: {
      ownersRequireCap: null,
      notes: "",
      evidenceFromReport: null,
    },
    rawSummary: null,
    extractionComparison: null,
    reportIndexNotes: null,
    ...rest,
  };
}

function newId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}-${Date.now().toString(36)}`;
}

/** Parse flexible date strings to YYYY-MM-DD when possible. */
export function parseFlexibleDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return s;
}

function addYears(isoDate: string, years: number): string | null {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(`${a}T12:00:00Z`);
  const db = new Date(`${b}T12:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

const DATE_RANGE_SPLIT = /\s*(?:→|->|–|—|\bto\b|\band\b)\s*/i;

const DATE_RANGE_CAPTURE =
  /(?:between\s+)?(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}).{0,32}?(?:→|->|–|—|\bto\b|\band\b).{0,32}?(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/i;

/** IRS-style note: "Intermediate Survey to be carried out between 12/09/2026 and 12/03/2027". */
export function extractIntermediateSurveyWindowFromText(text: string): {
  rangeStart: string | null;
  rangeEnd: string | null;
} {
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [
    /intermediate\s+survey[\s\S]{0,400}?between\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\s+and\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i,
    /intermediate\s+survey[\s\S]{0,400}?(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\s+to\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const rangeStart = parseFlexibleDate(match[1]);
    const rangeEnd = parseFlexibleDate(match[2]);
    if (rangeStart && rangeEnd) return { rangeStart, rangeEnd };
  }
  return { rangeStart: null, rangeEnd: null };
}

function intermediateWindowScore(rangeStart: string | null, rangeEnd: string | null): number {
  if (!rangeStart || !rangeEnd) return 0;
  const days = daysBetween(rangeStart, rangeEnd);
  if (days == null || days <= 0) return 0;
  // Class intermediate survey windows are typically ~6 months (±3 months from anniversary).
  if (days >= 150 && days <= 220) return 10;
  if (days >= 120 && days <= 250) return 6;
  if (days < 120) return 1;
  return 3;
}

function pickBetterRangeEnd(
  kind: ClassStatusSurveyKind,
  rangeStart: string | null,
  endA: string | null,
  endB: string | null,
): string | null {
  if (!endA) return endB;
  if (!endB) return endA;
  if (kind !== "intermediate_survey") return endA;
  const scoreA = intermediateWindowScore(rangeStart, endA);
  const scoreB = intermediateWindowScore(rangeStart, endB);
  if (scoreB > scoreA) return endB;
  if (scoreA > scoreB) return endA;
  if (!rangeStart) return endA;
  const daysA = daysBetween(rangeStart, endA);
  const daysB = daysBetween(rangeStart, endB);
  if (daysA != null && daysB != null && daysB > daysA) return endB;
  return endA;
}

function refineIntermediateSurveyItem(
  item: ClassStatusSurveyScheduleItem,
  localText: string | null,
): ClassStatusSurveyScheduleItem {
  if (item.kind !== "intermediate_survey") return item;

  const fromReportText = localText ? extractIntermediateSurveyWindowFromText(localText) : {
    rangeStart: null,
    rangeEnd: null,
  };

  let rangeStart = item.rangeStart;
  let rangeEnd = pickBetterRangeEnd(
    item.kind,
    rangeStart,
    item.rangeEnd,
    fromReportText.rangeEnd,
  );
  rangeStart = rangeStart ?? fromReportText.rangeStart;

  if (fromReportText.rangeStart && fromReportText.rangeEnd) {
    rangeStart = fromReportText.rangeStart;
    rangeEnd = fromReportText.rangeEnd;
  } else if (rangeStart && rangeEnd) {
    const currentScore = intermediateWindowScore(rangeStart, rangeEnd);
    const textScore = intermediateWindowScore(
      fromReportText.rangeStart,
      fromReportText.rangeEnd,
    );
    if (textScore > currentScore) {
      rangeStart = fromReportText.rangeStart ?? rangeStart;
      rangeEnd = fromReportText.rangeEnd ?? rangeEnd;
    }
  }

  if (rangeStart && rangeEnd && intermediateWindowScore(rangeStart, rangeEnd) <= 1) {
    const altEnd = pickBetterRangeEnd(item.kind, rangeStart, rangeEnd, item.dueDate);
    if (altEnd && intermediateWindowScore(rangeStart, altEnd) > intermediateWindowScore(rangeStart, rangeEnd)) {
      rangeEnd = altEnd;
    }
  }

  const dueDate =
    rangeEnd && rangeStart && intermediateWindowScore(rangeStart, rangeEnd) >= 6
      ? rangeEnd
      : item.dueDate;

  return {
    ...item,
    rangeStart,
    rangeEnd,
    dueDate,
    rangeLabel:
      rangeStart || rangeEnd
        ? [rangeStart, rangeEnd].filter(Boolean).join(" → ")
        : item.rangeLabel,
  };
}

function isIoppName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("iopp") ||
    n.includes("international oil pollution prevention") ||
    (n.includes("oil pollution") && n.includes("prevention"))
  );
}

function asStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v != null && String(v).trim()) out[k] = String(v).trim();
  }
  return out;
}

function asTableRows(prefix: string, values: unknown): ClassStatusTableRow[] {
  if (!Array.isArray(values)) return [];
  const out: ClassStatusTableRow[] = [];
  values.forEach((v, i) => {
    if (typeof v === "string" && v.trim()) {
      out.push({
        id: newId(prefix, i),
        ref: null,
        title: v.trim(),
        dueOrWindow: null,
        notes: null,
        sourceHint: null,
        attend: false,
        createdJobId: null,
      });
      return;
    }
    if (v && typeof v === "object") {
      const row = v as Record<string, unknown>;
      const title = String(row.title ?? row.text ?? row.description ?? row.name ?? "").trim();
      if (!title) return;
      out.push({
        id: newId(prefix, i),
        ref: row.ref != null && String(row.ref).trim() ? String(row.ref).trim() : null,
        title,
        dueOrWindow:
          parseFlexibleDate(row.dueOrWindow ?? row.due) ??
          (row.dueOrWindow != null ? String(row.dueOrWindow) : null),
        notes: row.notes != null && String(row.notes).trim() ? String(row.notes).trim() : null,
        sourceHint:
          row.sourceHint != null && String(row.sourceHint).trim()
            ? String(row.sourceHint).trim()
            : null,
        attend: Boolean(row.attend ?? row.includeInDryDock),
        createdJobId: null,
      });
    }
  });
  return out;
}

function normalizeCertificates(values: unknown): ClassStatusCertificate[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v, i) => {
      if (!v || typeof v !== "object") return null;
      const row = v as Record<string, unknown>;
      const name = String(row.name ?? row.title ?? row.certificate ?? "").trim();
      if (!name) return null;
      const issuedDate = parseFlexibleDate(row.issuedDate ?? row.issueDate ?? row.dateIssued);
      const expiryDate = parseFlexibleDate(row.expiryDate ?? row.expires ?? row.validTo);
      const annualFromModel = parseFlexibleDate(row.annualEndorsementDue);
      const annualEndorsementDue =
        annualFromModel || (issuedDate ? addYears(issuedDate, 1) : null);
      return {
        id: String(row.id ?? newId("cert", i)),
        name,
        certificateNumber:
          row.certificateNumber != null && String(row.certificateNumber).trim()
            ? String(row.certificateNumber).trim()
            : null,
        issuedDate,
        issuedPlace:
          row.issuedPlace != null && String(row.issuedPlace).trim()
            ? String(row.issuedPlace).trim()
            : null,
        issuedBy:
          row.issuedBy != null && String(row.issuedBy).trim()
            ? String(row.issuedBy).trim()
            : null,
        expiryDate,
        annualEndorsementDue,
        requiresAnnualEndorsement: row.requiresAnnualEndorsement !== false,
        isIopp: Boolean(row.isIopp) || isIoppName(name),
        notes: row.notes != null && String(row.notes).trim() ? String(row.notes).trim() : null,
      } satisfies ClassStatusCertificate;
    })
    .filter((x): x is ClassStatusCertificate => Boolean(x));
}

function normalizeConditions(values: unknown): ClassStatusConditionItem[] {
  if (!Array.isArray(values)) return [];
  const kinds = new Set(["coc", "statutory", "memorandum", "additional", "due_or_overdue"]);
  const out: ClassStatusConditionItem[] = [];
  values.forEach((v, i) => {
    if (!v || typeof v !== "object") return;
    const row = v as Record<string, unknown>;
    const title = String(row.title ?? row.text ?? row.description ?? "").trim();
    if (!title) return;
    const kindRaw = String(row.kind ?? "additional").toLowerCase();
    const kind = (kinds.has(kindRaw) ? kindRaw : "additional") as ClassStatusConditionItem["kind"];
    out.push({
      id: String(row.id ?? newId("cond", i)),
      kind,
      ref: row.ref != null && String(row.ref).trim() ? String(row.ref).trim() : null,
      title,
      dueOrWindow:
        parseFlexibleDate(row.dueOrWindow ?? row.due) ??
        (row.dueOrWindow != null ? String(row.dueOrWindow) : null),
      notes: row.notes != null && String(row.notes).trim() ? String(row.notes).trim() : null,
      attend: Boolean(row.attend) || kind === "coc" || kind === "due_or_overdue",
      createdJobId: null,
    });
  });
  return out;
}

function normalizeMachineryStatus(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/\bover[\s-]?due\b/.test(lower)) return "Overdue";
  if (/\bdue\b/.test(lower) && !/\bnot\s+due\b/.test(lower)) return "Due";
  if (/\bnot\s+due\b|\bupcoming\b|\bfuture\b/.test(lower)) return "Not due";
  if (/\bcomplet|\bdone\b|\bclosed\b/.test(lower)) return "Completed";
  if (/\bpending\b/.test(lower)) return "Pending";
  return s;
}

function normalizeClassCode(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Keep short alphanumeric Class/CSM codes (e.g. 0024, CSM-0615)
  const cleaned = s.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length > 32) return s.slice(0, 32);
  return cleaned;
}

function normalizeMachinery(
  values: unknown,
  opts: { referenceDate: string; dryDockStart: string | null; dryDockEnd: string | null },
): ClassStatusMachineryItem[] {
  if (!Array.isArray(values)) return [];
  const horizon = addYears(opts.referenceDate, 1) ?? opts.referenceDate;
  const out: ClassStatusMachineryItem[] = [];
  values.forEach((v, i) => {
    if (!v || typeof v !== "object") return;
    const row = v as Record<string, unknown>;
    const name = String(row.name ?? row.title ?? row.machinery ?? row.description ?? "").trim();
    if (!name) return;
    const lastDone = parseFlexibleDate(row.lastDone ?? row.lastSurvey ?? row.completed);
    const dueDate = parseFlexibleDate(row.dueDate ?? row.due ?? row.nextDue);
    const status = normalizeMachineryStatus(row.status ?? row.surveyStatus ?? row.state);
    const classCode = normalizeClassCode(
      row.classCode ?? row.code ?? row.itemCode ?? row.ref ?? row.classItemCode,
    );
    let includeInDryDock = Boolean(row.includeInDryDock);
    let reason =
      row.reason != null && String(row.reason).trim() ? String(row.reason).trim() : null;

    if (status === "Due" || status === "Overdue" || status === "Pending") {
      includeInDryDock = true;
      if (!reason) {
        reason =
          status === "Overdue"
            ? "Overdue on Class report — include in dry dock"
            : "Due / pending on Class report — include in dry dock";
      }
    }

    if (dueDate) {
      const delta = daysBetween(opts.referenceDate, dueDate);
      const dueInHorizon = delta != null && delta <= 366 && delta >= -30;
      const dueByHorizonEnd = dueDate <= horizon;
      let dueInDockWindow = false;
      if (opts.dryDockStart && opts.dryDockEnd) {
        dueInDockWindow = dueDate >= opts.dryDockStart && dueDate <= opts.dryDockEnd;
      } else if (opts.dryDockStart) {
        const end = addYears(opts.dryDockStart, 1) ?? opts.dryDockStart;
        dueInDockWindow = dueDate >= opts.dryDockStart && dueDate <= end;
      }
      if (dueInDockWindow || dueInHorizon || dueByHorizonEnd || dueDate < opts.referenceDate) {
        includeInDryDock = true;
        if (!reason) {
          reason =
            dueDate < opts.referenceDate
              ? "Overdue — include in dry dock"
              : dueInDockWindow
                ? "Due within planned dry-dock window"
                : "Due within next 12 months — include in dry dock";
        }
      }
    }

    out.push({
      id: String(row.id ?? newId("mach", i)),
      name,
      classCode,
      lastDone,
      dueDate,
      status,
      includeInDryDock,
      reason,
      attend: Boolean(row.attend) || includeInDryDock,
      createdJobId: null,
      machineryAssetId:
        row.machineryAssetId != null && String(row.machineryAssetId).trim()
          ? String(row.machineryAssetId).trim()
          : null,
    });
  });
  return out;
}

/** Merge OpenAI + local machinery by class code, then normalized name. */
export function mergeMachineryLists(
  primary: ClassStatusMachineryItem[],
  secondary: ClassStatusMachineryItem[],
): ClassStatusMachineryItem[] {
  const byCode = new Map<string, ClassStatusMachineryItem>();
  const byName = new Map<string, ClassStatusMachineryItem>();
  const out: ClassStatusMachineryItem[] = [];

  const index = (item: ClassStatusMachineryItem) => {
    if (item.classCode) byCode.set(item.classCode.toUpperCase(), item);
    byName.set(normalizeMachineryNameKey(item.name), item);
  };

  const upsert = (item: ClassStatusMachineryItem) => {
    const codeHit = item.classCode ? byCode.get(item.classCode.toUpperCase()) : undefined;
    const nameHit = byName.get(normalizeMachineryNameKey(item.name));
    const existing = codeHit ?? nameHit;
    if (!existing) {
      out.push(item);
      index(item);
      return;
    }
    const merged: ClassStatusMachineryItem = {
      ...existing,
      classCode: existing.classCode ?? item.classCode,
      lastDone: existing.lastDone ?? item.lastDone,
      dueDate: existing.dueDate ?? item.dueDate,
      status: existing.status ?? item.status,
      includeInDryDock: existing.includeInDryDock || item.includeInDryDock,
      reason: existing.reason ?? item.reason,
      attend: existing.attend || item.attend,
      machineryAssetId: existing.machineryAssetId ?? item.machineryAssetId,
    };
    const idx = out.findIndex((x) => x.id === existing.id);
    if (idx >= 0) out[idx] = merged;
    index(merged);
  };

  for (const item of primary) upsert(item);
  for (const item of secondary) upsert(item);
  return out;
}

export function normalizeMachineryNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Local fallback: IRS Section J / continuous survey items due in 6/12 months,
 * plus machinery names near "List Of Machinery Items" / "Next Due".
 */
export function extractMachineryFromLocalText(text: string): ClassStatusMachineryItem[] {
  if (!text.trim()) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: ClassStatusMachineryItem[] = [];
  const seen = new Set<string>();

  const pushName = (
    name: string,
    opts: { classCode?: string | null; includeInDryDock: boolean; reason: string; status?: string | null },
  ) => {
    const cleaned = name.replace(/^[\d.\-\s]+/, "").trim();
    if (cleaned.length < 4 || cleaned.length > 120) return;
    if (/^(page|printed|ir\s*class|ship\s+survey|name|status|code|next\s+due)/i.test(cleaned)) {
      return;
    }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(cleaned)) return;
    if (/^\d{4,}$/.test(cleaned)) return;
    const key = normalizeMachineryNameKey(cleaned);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      id: newId("local-mach", out.length),
      name: cleaned,
      classCode: opts.classCode ?? null,
      lastDone: null,
      dueDate: null,
      status: opts.status ?? null,
      includeInDryDock: opts.includeInDryDock,
      reason: opts.reason,
      attend: opts.includeInDryDock,
      createdJobId: null,
      machineryAssetId: null,
    });
  };

  // Section J (and equivalents): continuous survey items due in next 6/12 months.
  // IRS text extract often emits a block of codes, then a block of names — pair by order.
  let inDueSection = false;
  const pendingCodes: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (
      /list of continuous survey items due|continuous survey items due in next/i.test(line)
    ) {
      inDueSection = true;
      pendingCodes.length = 0;
      continue;
    }
    if (inDueSection) {
      if (/^[A-Z]\.\s+\S/.test(line) && !/continuous survey/i.test(line)) {
        inDueSection = false;
        pendingCodes.length = 0;
        continue;
      }
      if (/list of (surveyable|machinery)|survey history|tank coating/i.test(line)) {
        inDueSection = false;
        pendingCodes.length = 0;
        continue;
      }
      if (/^\d{3,5}$/.test(line)) {
        pendingCodes.push(line);
        continue;
      }
      if (/[A-Za-z]{3}/.test(line) && !/^\d{1,2}[\/\-.]/.test(line)) {
        const code = pendingCodes.shift() ?? null;
        pushName(line, {
          classCode: code,
          includeInDryDock: true,
          reason: "Continuous survey item due in next 6/12 months (local extract)",
          status: "Due",
        });
      }
    }
  }

  return out;
}

const SURVEY_KIND_DEFS: Array<{
  kind: ClassStatusSurveyKind;
  label: string;
  ref: string;
  match: RegExp;
}> = [
  {
    kind: "special_survey",
    label: "Special Survey",
    ref: "SS",
    match: /\bspecial\s+survey\b/i,
  },
  {
    kind: "intermediate_survey",
    label: "Intermediate Survey",
    ref: "ISS",
    match: /\bintermediate\s+survey\b/i,
  },
  {
    kind: "docking_survey",
    label: "Docking Survey",
    ref: "DS",
    match: /\bdocking\s+survey\b/i,
  },
  {
    kind: "continuous_survey_machinery",
    label: "Continuous Survey Machinery",
    ref: "CSM",
    match: /\bcontin(?:uous|ious)\s+survey\s*(?:of\s*)?machiner|\bcs\s*m\b|\bcsm\b/i,
  },
];

function surveyLabelForKind(kind: ClassStatusSurveyKind): string {
  return SURVEY_KIND_DEFS.find((d) => d.kind === kind)?.label ?? kind;
}

function surveyRefForKind(kind: ClassStatusSurveyKind): string {
  return SURVEY_KIND_DEFS.find((d) => d.kind === kind)?.ref ?? kind;
}

function normalizeSurveyStatus(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/\bover[\s-]?due\b/.test(lower)) return "Overdue";
  if (/\bdue\b/.test(lower) && !/\bnot\s+due\b/.test(lower)) return "Due";
  if (/\bnot\s+due\b|\bupcoming\b|\bfuture\b/.test(lower)) return "Not due";
  if (/\bcomplet|\bdone\b|\bclosed\b/.test(lower)) return "Completed";
  return s;
}

function isSurveyDueOrOverdue(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "due" || s === "overdue" || /\bover[\s-]?due\b/.test(s) || /^due\b/.test(s);
}

function surveyItemScore(item: ClassStatusSurveyScheduleItem): number {
  let score = 0;
  if (item.assignedDate) score += 2;
  if (item.dueDate) score += 3;
  if (item.rangeStart || item.rangeEnd || item.rangeLabel) score += 2;
  if (item.status) score += 2;
  if (item.notes) score += 1;
  return score;
}

function pickBetterSurveyItem(
  a: ClassStatusSurveyScheduleItem | null,
  b: ClassStatusSurveyScheduleItem | null,
): ClassStatusSurveyScheduleItem | null {
  if (!a) return b;
  if (!b) return a;
  const scoreA = surveyItemScore(a);
  const scoreB = surveyItemScore(b);
  const better = scoreB > scoreA ? b : a;
  const other = better === a ? b : a;
  const merged: ClassStatusSurveyScheduleItem = {
    ...better,
    assignedDate: better.assignedDate ?? other.assignedDate,
    dueDate: better.dueDate ?? other.dueDate,
    rangeStart: better.rangeStart ?? other.rangeStart,
    rangeEnd: pickBetterRangeEnd(
      better.kind,
      better.rangeStart ?? other.rangeStart ?? null,
      better.rangeEnd,
      other.rangeEnd,
    ),
    rangeLabel: better.rangeLabel ?? other.rangeLabel,
    status: better.status ?? other.status,
    notes: better.notes ?? other.notes,
    source:
      a.source === b.source
        ? a.source
        : "merged",
  };
  return merged;
}

function normalizeSurveyKind(value: unknown): ClassStatusSurveyKind | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("special")) return "special_survey";
  if (s.includes("intermediate")) return "intermediate_survey";
  if (s.includes("docking")) return "docking_survey";
  if (s.includes("continuous") || s.includes("continious") || s === "csm") {
    return "continuous_survey_machinery";
  }
  if (
    value === "special_survey" ||
    value === "intermediate_survey" ||
    value === "docking_survey" ||
    value === "continuous_survey_machinery"
  ) {
    return value;
  }
  return null;
}

function normalizeSurveyScheduleItems(
  value: unknown,
  defaultSource: ClassStatusSurveyScheduleItem["source"],
): ClassStatusSurveyScheduleItem[] {
  if (!Array.isArray(value)) return [];
  const byKind = new Map<ClassStatusSurveyKind, ClassStatusSurveyScheduleItem>();

  value.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const kind =
      normalizeSurveyKind(row.kind ?? row.type ?? row.code ?? row.name ?? row.title) ??
      normalizeSurveyKind(row.label);
    if (!kind) return;

    const rangeRaw = row.rangeDate ?? row.range ?? row.rangeLabel ?? row.window;
    let rangeStart = parseFlexibleDate(row.rangeStart ?? row.windowStart);
    let rangeEnd = parseFlexibleDate(row.rangeEnd ?? row.windowEnd);
    let rangeLabel: string | null =
      rangeRaw != null && String(rangeRaw).trim() ? String(rangeRaw).trim() : null;

    if (!rangeStart && !rangeEnd && rangeLabel) {
      const parts = rangeLabel.split(DATE_RANGE_SPLIT).filter(Boolean);
      if (parts.length >= 2) {
        rangeStart = parseFlexibleDate(parts[0]) ?? rangeStart;
        rangeEnd = parseFlexibleDate(parts[parts.length - 1]) ?? rangeEnd;
      }
    }

    const item: ClassStatusSurveyScheduleItem = {
      id: newId(`survey-${kind}`, i),
      kind,
      label: String(row.label ?? row.title ?? row.name ?? surveyLabelForKind(kind)).trim(),
      assignedDate: parseFlexibleDate(
        row.assignedDate ?? row.assigned ?? row.lastDone ?? row.dateAssigned,
      ),
      dueDate: parseFlexibleDate(row.dueDate ?? row.due ?? row.nextDue),
      rangeStart,
      rangeEnd,
      rangeLabel:
        rangeStart || rangeEnd
          ? [rangeStart, rangeEnd].filter(Boolean).join(" → ") || rangeLabel
          : rangeLabel,
      status: normalizeSurveyStatus(row.status ?? row.surveyStatus ?? row.state),
      source:
        row.source === "openai_pdf" || row.source === "local_text" || row.source === "merged"
          ? row.source
          : defaultSource,
      notes: row.notes != null && String(row.notes).trim() ? String(row.notes).trim() : null,
    };

    const prev = byKind.get(kind) ?? null;
    const best = pickBetterSurveyItem(prev, item);
    if (best) byKind.set(kind, best);
  });

  return SURVEY_KIND_DEFS.map((d) => byKind.get(d.kind)).filter(
    (x): x is ClassStatusSurveyScheduleItem => Boolean(x),
  );
}

export function extractSurveyScheduleFromLocalText(
  text: string,
): ClassStatusSurveyScheduleItem[] {
  if (!text.trim()) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const dateToken =
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/g;

  const issWindow = extractIntermediateSurveyWindowFromText(text);

  const out: ClassStatusSurveyScheduleItem[] = [];

  for (const def of SURVEY_KIND_DEFS) {
    let bestBlock = "";
    for (let i = 0; i < lines.length; i++) {
      if (!def.match.test(lines[i])) continue;
      const block = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? "", lines[i + 3] ?? ""].join(
        " ",
      );
      if (block.length > bestBlock.length) bestBlock = block;
    }
    if (!bestBlock && def.kind !== "intermediate_survey") continue;

    const dates = [...bestBlock.matchAll(dateToken)]
      .map((m) => parseFlexibleDate(m[1]))
      .filter((d): d is string => Boolean(d));

    const statusMatch = bestBlock.match(/\b(Over[\s-]?due|Due|Completed|Not\s+Due)\b/i);
    const rangeMatch = bestBlock.match(DATE_RANGE_CAPTURE);

    let rangeStart = rangeMatch ? parseFlexibleDate(rangeMatch[1]) : dates.length >= 3 ? dates[1] : null;
    let rangeEnd = rangeMatch ? parseFlexibleDate(rangeMatch[2]) : dates.length >= 3 ? dates[2] : null;

    if (def.kind === "intermediate_survey" && issWindow.rangeStart && issWindow.rangeEnd) {
      rangeStart = issWindow.rangeStart;
      rangeEnd = issWindow.rangeEnd;
    }

    const dueDate =
      def.kind === "intermediate_survey" && rangeEnd
        ? rangeEnd
        : dates[1] ?? dates[0] ?? null;

    out.push({
      id: newId(`local-${def.kind}`, 0),
      kind: def.kind,
      label: def.label,
      assignedDate:
        def.kind === "intermediate_survey" && rangeStart
          ? rangeStart
          : dates[0] ?? null,
      dueDate,
      rangeStart,
      rangeEnd,
      rangeLabel:
        rangeStart || rangeEnd
          ? [rangeStart, rangeEnd].filter(Boolean).join(" → ")
          : null,
      status: normalizeSurveyStatus(statusMatch?.[1] ?? null),
      source: "local_text",
      notes:
        def.kind === "intermediate_survey" && issWindow.rangeStart
          ? "Window from report note (between … and …)"
          : null,
    });
  }

  return out.map((item) =>
    item.kind === "intermediate_survey" ? refineIntermediateSurveyItem(item, text) : item,
  );
}

function syncConvenienceFieldsFromSurveys(
  surveys: ClassStatusSurveyScheduleItem[],
): Pick<
  ClassStatusSurveyPlanning,
  "intermediateSurveyWindowStart" | "intermediateSurveyWindowEnd" | "specialSurveyDue"
> {
  const iss = surveys.find((s) => s.kind === "intermediate_survey");
  const ss = surveys.find((s) => s.kind === "special_survey");
  return {
    intermediateSurveyWindowStart: iss?.rangeStart ?? iss?.assignedDate ?? null,
    intermediateSurveyWindowEnd: iss?.rangeEnd ?? iss?.dueDate ?? null,
    specialSurveyDue: ss?.dueDate ?? ss?.rangeEnd ?? null,
  };
}

/**
 * Finalize survey planning from report schedule rows (OpenAI + local),
 * keeping IOPP anniversary as informational only — never as SS/IS due basis.
 */
export function applySurveyPlanningRules(
  certificates: ClassStatusCertificate[],
  planningFromModel: Partial<ClassStatusSurveyPlanning> | null,
  localSurveys: ClassStatusSurveyScheduleItem[] = [],
  localText: string | null = null,
): ClassStatusSurveyPlanning {
  const iopp =
    certificates.find((c) => c.isIopp && c.issuedDate) ||
    certificates.find((c) => isIoppName(c.name) && c.issuedDate);

  const anniversaryDate =
    parseFlexibleDate(planningFromModel?.anniversaryDate) || iopp?.issuedDate || null;

  const fromModel = normalizeSurveyScheduleItems(
    planningFromModel?.surveys ?? [],
    "openai_pdf",
  );
  // Also accept legacy model fields as weak hints only when surveys[] empty
  if (fromModel.length === 0 && planningFromModel) {
    const legacy: ClassStatusSurveyScheduleItem[] = [];
    if (
      planningFromModel.intermediateSurveyWindowStart ||
      planningFromModel.intermediateSurveyWindowEnd
    ) {
      legacy.push({
        id: newId("legacy-iss", 0),
        kind: "intermediate_survey",
        label: "Intermediate Survey",
        assignedDate: null,
        dueDate: parseFlexibleDate(planningFromModel.intermediateSurveyWindowEnd),
        rangeStart: parseFlexibleDate(planningFromModel.intermediateSurveyWindowStart),
        rangeEnd: parseFlexibleDate(planningFromModel.intermediateSurveyWindowEnd),
        rangeLabel: null,
        status: null,
        source: "openai_pdf",
        notes: "Legacy window fields from model",
      });
    }
    if (planningFromModel.specialSurveyDue) {
      legacy.push({
        id: newId("legacy-ss", 0),
        kind: "special_survey",
        label: "Special Survey",
        assignedDate: null,
        dueDate: parseFlexibleDate(planningFromModel.specialSurveyDue),
        rangeStart: null,
        rangeEnd: null,
        rangeLabel: null,
        status: null,
        source: "openai_pdf",
        notes: "Legacy specialSurveyDue from model",
      });
    }
    fromModel.push(...legacy);
  }

  const mergedByKind = new Map<ClassStatusSurveyKind, ClassStatusSurveyScheduleItem>();
  for (const kind of SURVEY_KIND_DEFS.map((d) => d.kind)) {
    const openai = fromModel.find((s) => s.kind === kind) ?? null;
    const local = localSurveys.find((s) => s.kind === kind) ?? null;
    const best = pickBetterSurveyItem(openai, local);
    if (best) mergedByKind.set(kind, { ...best, label: surveyLabelForKind(kind) });
  }
  const surveys = SURVEY_KIND_DEFS.map((d) => mergedByKind.get(d.kind))
    .filter((x): x is ClassStatusSurveyScheduleItem => Boolean(x))
    .map((survey) =>
      survey.kind === "intermediate_survey"
        ? refineIntermediateSurveyItem(survey, localText)
        : survey,
    );

  const convenience = syncConvenienceFieldsFromSurveys(surveys);

  return {
    anniversaryDate,
    anniversarySource: anniversaryDate
      ? iopp
        ? `IOPP certificate issued date (${iopp.name}) — informational only`
        : planningFromModel?.anniversarySource ?? "Report / IOPP (informational only)"
      : null,
    ...convenience,
    surveys,
    notes:
      planningFromModel?.notes ??
      (surveys.length > 0
        ? "Survey due dates taken from Class Status Report schedule (Special / Intermediate / Docking / CSM), combining OpenAI PDF + local extract."
        : "Survey schedule rows not found in report — check Special / Intermediate / Docking / Continuous Survey Machinery table."),
  };
}

function formatSurveyDueOrWindow(item: ClassStatusSurveyScheduleItem): string | null {
  if (item.rangeLabel) return item.rangeLabel;
  if (item.rangeStart || item.rangeEnd) {
    return [item.rangeStart, item.rangeEnd].filter(Boolean).join(" → ");
  }
  return item.dueDate;
}

function buildJobRowsFromStructured(analysis: {
  surveyPlanning: ClassStatusSurveyPlanning;
  conditions: ClassStatusConditionItem[];
  machinery: ClassStatusMachineryItem[];
  jobsFromModel: ClassStatusTableRow[];
}): ClassStatusTableRow[] {
  const rows: ClassStatusTableRow[] = [...analysis.jobsFromModel];
  const titles = new Set(rows.map((r) => r.title.toLowerCase()));

  const pushUnique = (row: ClassStatusTableRow) => {
    const key = row.title.toLowerCase();
    if (titles.has(key)) return;
    titles.add(key);
    rows.push(row);
  };

  for (const survey of analysis.surveyPlanning.surveys) {
    const dueOrWindow = formatSurveyDueOrWindow(survey);
    const attend = isSurveyDueOrOverdue(survey.status) || Boolean(survey.dueDate);
    pushUnique({
      id: survey.id,
      ref: surveyRefForKind(survey.kind),
      title: survey.label,
      dueOrWindow,
      notes: [
        survey.assignedDate ? `Assigned: ${survey.assignedDate}` : null,
        survey.dueDate ? `Due: ${survey.dueDate}` : null,
        survey.status ? `Status: ${survey.status}` : null,
        survey.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      sourceHint: `survey schedule · ${survey.source}`,
      attend,
      createdJobId: null,
    });
  }

  for (const c of analysis.conditions) {
    if (c.kind === "due_or_overdue" || c.kind === "coc" || c.kind === "statutory") {
      pushUnique({
        id: c.id,
        ref: c.ref,
        title: c.title,
        dueOrWindow: c.dueOrWindow,
        notes: c.notes,
        sourceHint: c.kind,
        attend: c.attend,
        createdJobId: c.createdJobId,
      });
    }
  }

  for (const m of analysis.machinery) {
    if (m.includeInDryDock || m.attend) {
      pushUnique({
        id: m.id,
        ref: m.classCode,
        title: m.name,
        dueOrWindow: m.dueDate,
        notes: [
          m.status ? `Status: ${m.status}` : null,
          m.lastDone ? `Last done: ${m.lastDone}` : null,
          m.reason,
        ]
          .filter(Boolean)
          .join(" · "),
        sourceHint: "machinery",
        attend: m.attend || m.includeInDryDock,
        createdJobId: m.createdJobId,
      });
    }
  }

  return rows;
}

function migrateV1ToV3(v1: ClassStatusAnalysisV1): ClassStatusAnalysis {
  const jobs = asTableRows(
    "job",
    (v1.dueJobs ?? []).map((l) => ({
      title: l.text,
      sourceHint: l.sourceHint,
      attend: l.confirmed,
    })),
  ).concat(
    asTableRows(
      "rec",
      (v1.recommendations ?? []).map((l) => ({
        title: l.text,
        sourceHint: l.sourceHint,
        attend: l.confirmed,
      })),
    ),
  );
  const cocs = asTableRows(
    "coc",
    (v1.cocs ?? []).map((l) => ({
      title: l.text,
      sourceHint: l.sourceHint,
      attend: l.confirmed,
    })),
  );
  const otherItems = asTableRows(
    "other",
    (v1.specialCertifications ?? []).map((l) => ({
      title: l.text,
      sourceHint: l.sourceHint,
      attend: l.confirmed,
    })),
  );
  return emptyClassStatusAnalysis({
    sourceAttachmentId: v1.sourceAttachmentId ?? null,
    sourceFileName: v1.sourceFileName ?? null,
    analyzedAt: v1.analyzedAt ?? new Date().toISOString(),
    model: v1.model ?? null,
    jobs,
    cocs,
    otherItems,
    capCertification: v1.capCertification ?? {
      ownersRequireCap: null,
      notes: "",
      evidenceFromReport: null,
    },
    rawSummary: v1.rawSummary ?? null,
  });
}

function migrateV2ToV3(v2: ClassStatusAnalysisV2): ClassStatusAnalysis {
  return emptyClassStatusAnalysis({
    sourceAttachmentId: v2.sourceAttachmentId ?? null,
    sourceFileName: v2.sourceFileName ?? null,
    analyzedAt: v2.analyzedAt ?? new Date().toISOString(),
    model: v2.model ?? null,
    jobs: Array.isArray(v2.jobs) ? v2.jobs : [],
    cocs: Array.isArray(v2.cocs) ? v2.cocs : [],
    otherItems: Array.isArray(v2.otherItems) ? v2.otherItems : [],
    capCertification: v2.capCertification ?? {
      ownersRequireCap: null,
      notes: "",
      evidenceFromReport: null,
    },
    rawSummary: v2.rawSummary ?? null,
    extractionComparison: v2.extractionComparison ?? null,
  });
}

function extractTextFromPdfBufferFallback(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\)]){4,}\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const inner = match[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (/[A-Za-z]{3}/.test(inner)) chunks.push(inner);
  }
  return chunks.join("\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, 120_000);
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    const rawText = result.text as string | string[] | undefined;
    const text =
      typeof rawText === "string"
        ? rawText
        : Array.isArray(rawText)
          ? rawText.join("\n")
          : "";
    const cleaned = text.replace(/\u0000/g, "").trim();
    if (cleaned.length >= 40) return cleaned.slice(0, 120_000);
  } catch {
    // fall through
  }
  return extractTextFromPdfBufferFallback(buffer);
}

const EXTRACTION_JSON_SHAPE = `{
  "vessel": {
    "vesselName": string|null, "classificationSociety": string|null, "classNumber": string|null,
    "imoNumber": string|null, "irNumber": string|null, "vesselType": string|null,
    "grossTonnage": string|null, "deadweight": string|null, "portOfRegistry": string|null,
    "flag": string|null, "dateOfBuild": string|null, "reportGeneratedOn": string|null,
    "extra": { [label: string]: string }
  },
  "parties": {
    "registeredOwner": string|null, "owner": string|null, "manager": string|null,
    "ismManager": string|null, "invoicingAddress": string|null,
    "extra": { [label: string]: string }
  },
  "reportIndexNotes": string|null,
  "certificates": [{
    "name": string, "certificateNumber": string|null, "issuedDate": string|null,
    "issuedPlace": string|null, "issuedBy": string|null, "expiryDate": string|null,
    "isIopp": boolean, "notes": string|null
  }],
  "surveyPlanning": {
    "anniversaryDate": string|null,
    "anniversarySource": string|null,
    "surveys": [{
      "kind": "special_survey"|"intermediate_survey"|"docking_survey"|"continuous_survey_machinery",
      "label": string,
      "assignedDate": string|null,
      "dueDate": string|null,
      "rangeStart": string|null,
      "rangeEnd": string|null,
      "rangeDate": string|null,
      "status": "Due"|"Overdue"|"Completed"|"Not due"|string|null,
      "notes": string|null
    }],
    "notes": string|null
  },
  "conditions": [{
    "kind": "coc"|"statutory"|"memorandum"|"additional"|"due_or_overdue",
    "ref": string|null, "title": string, "dueOrWindow": string|null, "notes": string|null
  }],
  "machinery": [{
    "name": string, "classCode": string|null, "lastDone": string|null, "dueDate": string|null,
    "status": "Due"|"Overdue"|"Completed"|"Not due"|"Pending"|string|null,
    "includeInDryDock": boolean, "reason": string|null
  }],
  "jobs": [{"ref": string|null, "title": string, "dueOrWindow": string|null, "notes": string|null, "sourceHint": string|null}],
  "cocs": [{"ref": string|null, "title": string, "dueOrWindow": string|null, "notes": string|null, "sourceHint": string|null}],
  "otherItems": [{"ref": string|null, "title": string, "dueOrWindow": string|null, "notes": string|null, "sourceHint": string|null}],
  "capCertification": { "ownersRequireCap": true|false|null, "evidenceFromReport": string|null, "notes": string },
  "rawSummary": string,
  "extractionComparison": { "preferredSource": "openai_pdf"|"local_text"|"merged", "note": string }
}`;

const DOMAIN_RULES = `You are extracting a CLASS / SHIP SURVEY STATUS REPORT for dry-dock planning. Read pages in order. Do NOT invent data.

REPORT STRUCTURE (read thoroughly, page by page):
1) Cover / Ship Survey Status: classification society that issued the status; vessel identity.
2) Vessel particulars: class/IR number, IMO, type, GT, DWT, port of registry, flag, date of build, report generated date — capture ALL fields into vessel + vessel.extra.
3) Index / contents: note what later sections contain (reportIndexNotes).
4) Further vessel / machinery association + parties: owners, managers, ISM manager, invoicing address — capture ALL into parties (+ parties.extra).
5) Certificates table(s): every certificate with name, number, issued date, place of issuance, issued by, expiry date. Mark IOPP (International Oil Pollution Prevention) with isIopp=true.
6) SURVEY SCHEDULE / PLANNING table (CRITICAL — primary source for dry-dock survey due dates):
   Extract these four surveys when present (exact labels may vary slightly):
   - Special Survey
   - Intermediate Survey
   - Docking Survey
   - Continuous Survey Machinery (also CSM / Continuous Survey of Machinery)
   For EACH survey capture: assignedDate, dueDate, rangeDate (or rangeStart/rangeEnd), and status (Due / Overdue / Completed / Not due).
   Put them in surveyPlanning.surveys[]. Do NOT invent dates. Do NOT calculate Special/Intermediate from anniversary.
   INTERMEDIATE SURVEY (critical): often has blank Assigned/Due columns and an italic note such as
   "Intermediate Survey to be carried out between 12/09/2026 and 12/03/2027".
   rangeStart = first date, rangeEnd = second date (latest). Do NOT use Annual Survey due date as rangeEnd.
7) After certificates: due / overdue inspections & certificates → conditions kind "due_or_overdue".
8) Conditions of Class → kind "coc"; Statutory conditions → "statutory"; Memorandum → "memorandum"; Additional information → "additional".
9) MACHINERY / CONTINUOUS SURVEY ITEMS (CRITICAL for dry-dock jobs + register sync):
   a) Section titled like "List of continuous survey items due in next 6 months/ 12 months" (IRS Section J or equivalent)
      — extract EVERY item: classCode (item code), name/description, lastDone, dueDate/next due, status.
      ALL of these are upcoming Class work → includeInDryDock=true with reason.
   b) Machinery / CSM item tables ("List Of Machinery Items") with Status, Cycle, Last Done / Date, Next Due
      — extract items that are Due, Overdue, Pending, or due within 12 months / dry-dock window.
      Include name, classCode, lastDone, dueDate, status, includeInDryDock.
   Do NOT dump hundreds of Completed/Not-due historical register rows — prioritize due/overdue/upcoming.
   If the report only has a compact machinery list, extract it all.
   classCode is essential for matching on re-upload (IRS numeric codes like 0024, 0615).

DATE RULES:
- Survey due dates for Special / Intermediate / Docking / CSM MUST come from the report survey schedule table columns (Assigned Date, Due Date, Range, Status). Never derive them as anniversary+2.5y / +5y.
- Intermediate Survey window end is the LATER date in the "between … and …" note (typically ~6 months after window start). Never substitute Annual Survey due date (often 12/12/YYYY) as the intermediate window end.
- Anniversary date = IOPP certificate ISSUED date (informational only). Put in surveyPlanning.anniversaryDate if found; do not use it to invent survey dues.
- Every certificate requires annual endorsement: annual endorsement due ≈ issued date + 1 year (code will recompute; still list issued/expiry carefully).
- Prefer ISO dates YYYY-MM-DD when possible.

JOBS / COCs tables:
- jobs = surveys/inspections/machinery/recommendations to attend in dry dock (include unit numbers when present). Prefer including the four surveys when status is Due or Overdue.
- Also put continuous-survey / machinery items with includeInDryDock=true into jobs (title = machinery name, ref = classCode when present).
- cocs = Conditions of Class lines.
- Be exhaustive — do not skip certificates, COCs, survey schedule rows, or machinery due items.
- Prefer PDF content over LOCAL_EXTRACT; use local to fill gaps; set extractionComparison accordingly. Prefer preferredSource "merged" when both PDF and local survey schedule / machinery data are used.`;

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("OpenAI returned invalid JSON for class status analysis.");
  }
}

function outputTextFromResponses(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (typeof row.output_text === "string" && row.output_text.trim()) {
    return row.output_text;
  }
  if (!Array.isArray(row.output)) return null;
  const parts: string[] = [];
  for (const item of row.output) {
    if (!Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if ((c.type === "output_text" || c.type === "text") && c.text) parts.push(c.text);
    }
  }
  return parts.join("\n").trim() || null;
}

const MAX_PDF_BYTES = 15 * 1024 * 1024;

function parsedToAnalysis(
  parsed: Record<string, unknown>,
  meta: {
    fileName: string;
    attachmentId?: string | null;
    model: string;
    localCharCount: number;
    openaiPdfUsed: boolean;
    dryDockStart: string | null;
    dryDockEnd: string | null;
    localSurveys?: ClassStatusSurveyScheduleItem[];
    localMachinery?: ClassStatusMachineryItem[];
    localText?: string | null;
  },
): ClassStatusAnalysis {
  const vesselRaw =
    parsed.vessel && typeof parsed.vessel === "object"
      ? (parsed.vessel as Record<string, unknown>)
      : {};
  const partiesRaw =
    parsed.parties && typeof parsed.parties === "object"
      ? (parsed.parties as Record<string, unknown>)
      : {};
  const planningRaw =
    parsed.surveyPlanning && typeof parsed.surveyPlanning === "object"
      ? (parsed.surveyPlanning as Partial<ClassStatusSurveyPlanning>)
      : null;

  const certificates = normalizeCertificates(parsed.certificates);
  // Ensure annual endorsement = issued + 1y
  const certificatesFixed = certificates.map((c) => ({
    ...c,
    annualEndorsementDue: c.issuedDate ? addYears(c.issuedDate, 1) : c.annualEndorsementDue,
    requiresAnnualEndorsement: true,
    isIopp: c.isIopp || isIoppName(c.name),
  }));

  const surveyPlanning = applySurveyPlanningRules(
    certificatesFixed,
    planningRaw,
    meta.localSurveys ?? [],
    meta.localText ?? null,
  );
  const referenceDate =
    parseFlexibleDate(vesselRaw.reportGeneratedOn) ||
    new Date().toISOString().slice(0, 10);

  const conditions = normalizeConditions(parsed.conditions);
  const fromModel = normalizeMachinery(parsed.machinery, {
    referenceDate,
    dryDockStart: meta.dryDockStart,
    dryDockEnd: meta.dryDockEnd,
  });
  const fromLocal = meta.localMachinery ?? [];
  const machinery = mergeMachineryLists(fromModel, fromLocal);

  const jobsFromModel = [
    ...asTableRows("job", parsed.jobs ?? parsed.dueJobs),
    ...asTableRows("rec", parsed.recommendations),
  ];
  const cocsFromModel = asTableRows("coc", parsed.cocs);
  const cocsFromConditions = conditions
    .filter((c) => c.kind === "coc")
    .map(
      (c): ClassStatusTableRow => ({
        id: c.id,
        ref: c.ref,
        title: c.title,
        dueOrWindow: c.dueOrWindow,
        notes: c.notes,
        sourceHint: "coc",
        attend: true,
        createdJobId: null,
      }),
    );
  const otherItems = [
    ...asTableRows("other", parsed.otherItems),
    ...asTableRows("cert", parsed.specialCertifications),
    ...conditions
      .filter((c) => c.kind === "memorandum" || c.kind === "additional")
      .map(
        (c): ClassStatusTableRow => ({
          id: c.id,
          ref: c.ref,
          title: c.title,
          dueOrWindow: c.dueOrWindow,
          notes: c.notes,
          sourceHint: c.kind,
          attend: false,
          createdJobId: null,
        }),
      ),
  ];

  const jobs = buildJobRowsFromStructured({
    surveyPlanning,
    conditions,
    machinery,
    jobsFromModel,
  });

  const cocTitles = new Set(cocsFromModel.map((c) => c.title.toLowerCase()));
  const cocs = [
    ...cocsFromModel,
    ...cocsFromConditions.filter((c) => !cocTitles.has(c.title.toLowerCase())),
  ];

  const capRaw =
    parsed.capCertification && typeof parsed.capCertification === "object"
      ? (parsed.capCertification as Record<string, unknown>)
      : {};
  let ownersRequireCap: boolean | null = null;
  if (capRaw.ownersRequireCap === true) ownersRequireCap = true;
  if (capRaw.ownersRequireCap === false) ownersRequireCap = false;

  const cmpRaw =
    parsed.extractionComparison && typeof parsed.extractionComparison === "object"
      ? (parsed.extractionComparison as Record<string, unknown>)
      : {};
  let preferredSource: ClassStatusExtractionComparison["preferredSource"] = meta.openaiPdfUsed
    ? "openai_pdf"
    : "local_text";
  if (
    cmpRaw.preferredSource === "openai_pdf" ||
    cmpRaw.preferredSource === "local_text" ||
    cmpRaw.preferredSource === "merged"
  ) {
    preferredSource = cmpRaw.preferredSource;
  }

  const vessel: ClassStatusVesselProfile = {
    vesselName: vesselRaw.vesselName ? String(vesselRaw.vesselName) : null,
    classificationSociety: vesselRaw.classificationSociety
      ? String(vesselRaw.classificationSociety)
      : null,
    classNumber: vesselRaw.classNumber ? String(vesselRaw.classNumber) : null,
    imoNumber: vesselRaw.imoNumber ? String(vesselRaw.imoNumber) : null,
    irNumber: vesselRaw.irNumber ? String(vesselRaw.irNumber) : null,
    vesselType: vesselRaw.vesselType ? String(vesselRaw.vesselType) : null,
    grossTonnage: vesselRaw.grossTonnage ? String(vesselRaw.grossTonnage) : null,
    deadweight: vesselRaw.deadweight ? String(vesselRaw.deadweight) : null,
    portOfRegistry: vesselRaw.portOfRegistry ? String(vesselRaw.portOfRegistry) : null,
    flag: vesselRaw.flag ? String(vesselRaw.flag) : null,
    dateOfBuild: parseFlexibleDate(vesselRaw.dateOfBuild),
    reportGeneratedOn: parseFlexibleDate(vesselRaw.reportGeneratedOn),
    extra: asStringMap(vesselRaw.extra),
  };

  const parties: ClassStatusParties = {
    registeredOwner: partiesRaw.registeredOwner ? String(partiesRaw.registeredOwner) : null,
    owner: partiesRaw.owner ? String(partiesRaw.owner) : null,
    manager: partiesRaw.manager ? String(partiesRaw.manager) : null,
    ismManager: partiesRaw.ismManager ? String(partiesRaw.ismManager) : null,
    invoicingAddress: partiesRaw.invoicingAddress ? String(partiesRaw.invoicingAddress) : null,
    extra: asStringMap(partiesRaw.extra),
  };

  const rawSummary = parsed.rawSummary
    ? String(parsed.rawSummary)
    : `Vessel ${vessel.vesselName ?? "—"}; ${certificatesFixed.length} cert(s); ${surveyPlanning.surveys.length} survey schedule row(s); ${jobs.length} dry-dock job candidate(s).`;

  const usedLocalSurveys = (meta.localSurveys?.length ?? 0) > 0;
  const usedLocalMachinery = (meta.localMachinery?.length ?? 0) > 0;
  const usedOpenAiSurveys =
    (Array.isArray(planningRaw?.surveys) && planningRaw.surveys.length > 0) ||
    Boolean(planningRaw?.specialSurveyDue);
  if (
    (usedLocalSurveys || usedLocalMachinery) &&
    (meta.openaiPdfUsed || usedOpenAiSurveys || fromModel.length > 0)
  ) {
    preferredSource = "merged";
  }

  const note =
    String(cmpRaw.note ?? "").trim() ||
    (preferredSource === "merged"
      ? `Merged OpenAI PDF + local extract (${surveyPlanning.surveys.length} surveys, ${machinery.length} machinery; local ${meta.localCharCount} chars).`
      : meta.openaiPdfUsed
        ? `OpenAI PDF read; local extract ${meta.localCharCount} chars compared.`
        : `Local text only (${meta.localCharCount} chars).`);

  return emptyClassStatusAnalysis({
    sourceAttachmentId: meta.attachmentId ?? null,
    sourceFileName: meta.fileName,
    analyzedAt: new Date().toISOString(),
    model: meta.model,
    vessel,
    parties,
    certificates: certificatesFixed,
    surveyPlanning,
    conditions,
    machinery,
    jobs,
    cocs,
    otherItems,
    capCertification: {
      ownersRequireCap,
      notes: String(capRaw.notes ?? ""),
      evidenceFromReport: capRaw.evidenceFromReport
        ? String(capRaw.evidenceFromReport)
        : null,
    },
    rawSummary: `${rawSummary} · ${note}`.slice(0, 1200),
    extractionComparison: {
      localCharCount: meta.localCharCount,
      openaiPdfUsed: meta.openaiPdfUsed,
      preferredSource,
      note,
    },
    reportIndexNotes: parsed.reportIndexNotes ? String(parsed.reportIndexNotes) : null,
  });
}

async function openaiAnalyzePdfOnline(input: {
  apiKey: string;
  model: string;
  fileName: string;
  pdfBuffer: Buffer;
  localExtract: string;
  dryDockStart: string | null;
  dryDockEnd: string | null;
}): Promise<Record<string, unknown>> {
  if (input.pdfBuffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF is too large for OpenAI online read (${Math.round(input.pdfBuffer.byteLength / (1024 * 1024))} MB). Max ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
    );
  }

  const fileData = `data:application/pdf;base64,${input.pdfBuffer.toString("base64")}`;
  const localSnippet = input.localExtract.trim().slice(0, 18_000);
  const dockNote =
    input.dryDockStart || input.dryDockEnd
      ? `Planned dry dock window: ${input.dryDockStart ?? "?"} → ${input.dryDockEnd ?? "?"}.`
      : "Planned dry dock window not set — use next 12 months horizon for includeInDryDock.";

  const prompt = `${DOMAIN_RULES}

Return strict JSON only matching:
${EXTRACTION_JSON_SHAPE}

File name: ${input.fileName}
${dockNote}

LOCAL_EXTRACT (${input.localExtract.trim().length} chars; may be noisy):
${localSnippet || "(empty — rely on PDF online read)"}`;

  const responsesRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.05,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: input.fileName,
              file_data: fileData,
              detail: "high",
            },
            { type: "input_text", text: prompt },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
    }),
  });

  if (responsesRes.ok) {
    const data = await responsesRes.json();
    const text = outputTextFromResponses(data);
    if (text) return extractJsonObject(text);
  }

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.05,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "file", file: { filename: input.fileName, file_data: fileData } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!chatRes.ok) {
    const errA = responsesRes.ok ? "" : await responsesRes.text().catch(() => "");
    const errB = await chatRes.text();
    throw new Error(
      `OpenAI PDF online read failed (${chatRes.status}): ${(errB || errA).slice(0, 400)}`,
    );
  }

  const chatData = (await chatRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = chatData.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI PDF online read returned empty content.");
  return extractJsonObject(content);
}

async function openaiAnalyzeLocalTextOnly(input: {
  apiKey: string;
  model: string;
  fileName: string;
  text: string;
  dryDockStart: string | null;
  dryDockEnd: string | null;
}): Promise<Record<string, unknown>> {
  const dockNote =
    input.dryDockStart || input.dryDockEnd
      ? `Planned dry dock window: ${input.dryDockStart ?? "?"} → ${input.dryDockEnd ?? "?"}.`
      : "Planned dry dock window not set — use next 12 months horizon for includeInDryDock.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.05,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${DOMAIN_RULES}\nReturn JSON:\n${EXTRACTION_JSON_SHAPE}\nSet preferredSource to local_text.`,
        },
        {
          role: "user",
          content: `File: ${input.fileName}\n${dockNote}\n\nLOCAL_EXTRACT:\n${input.text.slice(0, 100_000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI text analysis failed (${res.status}): ${errText.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty analysis.");
  return extractJsonObject(content);
}

export async function analyzeClassStatusReport(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  attachmentId?: string | null;
  dryDockStart?: string | null;
  dryDockEnd?: string | null;
}): Promise<ClassStatusAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_CLASS_STATUS_MODEL?.trim() || "gpt-4o-mini";
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to the server environment to analyze Class Status Reports.",
    );
  }

  const dryDockStart = parseFlexibleDate(input.dryDockStart);
  const dryDockEnd = parseFlexibleDate(input.dryDockEnd);

  const lower = input.fileName.toLowerCase();
  const isPdf =
    input.mimeType?.includes("pdf") ||
    lower.endsWith(".pdf") ||
    input.buffer.subarray(0, 4).toString("utf8") === "%PDF";

  const localExtract = isPdf
    ? await extractTextFromPdfBuffer(input.buffer)
    : input.buffer.toString("utf8").slice(0, 120_000);
  const localCharCount = localExtract.trim().length;
  const localSurveys = extractSurveyScheduleFromLocalText(localExtract);
  const localMachinery = extractMachineryFromLocalText(localExtract);

  if (isPdf) {
    try {
      const parsed = await openaiAnalyzePdfOnline({
        apiKey,
        model,
        fileName: input.fileName,
        pdfBuffer: input.buffer,
        localExtract,
        dryDockStart,
        dryDockEnd,
      });
      return parsedToAnalysis(parsed, {
        fileName: input.fileName,
        attachmentId: input.attachmentId,
        model,
        localCharCount,
        openaiPdfUsed: true,
        dryDockStart,
        dryDockEnd,
        localSurveys,
        localMachinery,
        localText: localExtract,
      });
    } catch (pdfErr) {
      if (localCharCount < 40) {
        throw pdfErr instanceof Error
          ? pdfErr
          : new Error("OpenAI PDF online read failed and local extract was empty.");
      }
      const parsed = await openaiAnalyzeLocalTextOnly({
        apiKey,
        model,
        fileName: input.fileName,
        text: localExtract,
        dryDockStart,
        dryDockEnd,
      });
      const analysis = parsedToAnalysis(parsed, {
        fileName: input.fileName,
        attachmentId: input.attachmentId,
        model,
        localCharCount,
        openaiPdfUsed: false,
        dryDockStart,
        dryDockEnd,
        localSurveys,
        localMachinery,
        localText: localExtract,
      });
      const failNote =
        pdfErr instanceof Error ? pdfErr.message.slice(0, 160) : "PDF online read failed";
      return {
        ...analysis,
        extractionComparison: {
          localCharCount,
          openaiPdfUsed: false,
          preferredSource:
            localSurveys.length > 0 || localMachinery.length > 0 ? "merged" : "local_text",
          note: `Fell back to local extract after OpenAI PDF read failed: ${failNote}`,
        },
      };
    }
  }

  if (localCharCount < 40) {
    throw new Error(
      "Could not read text from the uploaded Class Status Report. Upload a PDF for OpenAI online reading.",
    );
  }

  const parsed = await openaiAnalyzeLocalTextOnly({
    apiKey,
    model,
    fileName: input.fileName,
    text: localExtract,
    dryDockStart,
    dryDockEnd,
  });
  return parsedToAnalysis(parsed, {
    fileName: input.fileName,
    attachmentId: input.attachmentId,
    model,
    localCharCount,
    openaiPdfUsed: false,
    dryDockStart,
    dryDockEnd,
    localSurveys,
    localMachinery,
    localText: localExtract,
  });
}

export function isClassStatusChecklistTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("class status") || t.includes("class documentation");
}

/** True when a Class Status Report was uploaded and analyzed for this checklist item. */
export function hasCompletedClassStatusUpload(classStatusAnalysis: unknown): boolean {
  const analysis = parseStoredClassStatusAnalysis(classStatusAnalysis);
  return analysis != null && Boolean(analysis.sourceAttachmentId);
}

export function parseStoredClassStatusAnalysis(
  value: unknown,
): ClassStatusAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { version?: number };
  if (row.version === 1) return migrateV1ToV3(value as ClassStatusAnalysisV1);
  if (row.version === 2) return migrateV2ToV3(value as ClassStatusAnalysisV2);
  if (row.version !== 3) return null;

  const v3 = value as Partial<ClassStatusAnalysis>;
  return emptyClassStatusAnalysis({
    ...v3,
    vessel: { ...emptyVessel(), ...(v3.vessel ?? {}) },
    parties: { ...emptyParties(), ...(v3.parties ?? {}) },
    certificates: Array.isArray(v3.certificates) ? v3.certificates : [],
    surveyPlanning: {
      ...emptySurveyPlanning(),
      ...(v3.surveyPlanning ?? {}),
      surveys: Array.isArray(v3.surveyPlanning?.surveys) ? v3.surveyPlanning.surveys : [],
    },
    conditions: Array.isArray(v3.conditions) ? v3.conditions : [],
    machinery: Array.isArray(v3.machinery)
      ? v3.machinery.map((m) => ({
          ...m,
          classCode: m.classCode ?? null,
          status: m.status ?? null,
          machineryAssetId: m.machineryAssetId ?? null,
        }))
      : [],
    machinerySync: Array.isArray(v3.machinerySync) ? v3.machinerySync : [],
    jobs: Array.isArray(v3.jobs) ? v3.jobs : [],
    cocs: Array.isArray(v3.cocs) ? v3.cocs : [],
    otherItems: Array.isArray(v3.otherItems) ? v3.otherItems : [],
    capCertification: v3.capCertification ?? {
      ownersRequireCap: null,
      notes: "",
      evidenceFromReport: null,
    },
  });
}

export function allClassStatusRows(analysis: ClassStatusAnalysis): ClassStatusTableRow[] {
  return [...analysis.jobs, ...analysis.cocs, ...analysis.otherItems];
}

export function classStatusLineTag(lineId: string): string {
  return `[classStatusLineId=${lineId}]`;
}

export function buildJobDescriptionFromClassRow(
  row: ClassStatusTableRow,
  kind: "Class" | "COC" | "Class other",
  sourceFileName: string | null,
): string {
  const parts = [
    `Source: Class Status Report${sourceFileName ? ` (${sourceFileName})` : ""}.`,
    `Type: ${kind}.`,
    row.dueOrWindow ? `Due / window: ${row.dueOrWindow}.` : null,
    row.notes ? `Notes: ${row.notes}.` : null,
    row.sourceHint ? `Report hint: ${row.sourceHint}.` : null,
    classStatusLineTag(row.id),
  ];
  return parts.filter(Boolean).join("\n");
}
