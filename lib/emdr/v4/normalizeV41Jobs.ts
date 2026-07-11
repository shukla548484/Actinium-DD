import type { DryDockProjectType } from "@prisma/client";
import type { ParsedMasterJobRow } from "@/lib/mtil/import/parseWorkbook";
import {
  V41_BUDGET_CATEGORIES,
  V41_DESCRIPTION_MAX_LENGTH,
  V41_JOB_ROUTES,
  V41_VALIDATION_STATUSES,
  V41_VESSEL_TYPES,
  type V41BudgetCategory,
  type V41JobRoute,
  type V41ValidationStatus,
} from "@/lib/emdr/v4/constants";
import type { V40JobMetadataOverlay } from "@/lib/emdr/v4/loadV40MetadataOverlay";

export type V41ValidationIssue = {
  canonicalJobId: string;
  severity: V41ValidationStatus;
  rule: string;
  field: string;
  message: string;
  route: V41JobRoute | "All";
};

export type V41NormalizedJob = {
  canonicalJobId: string;
  machinery: string;
  component: string;
  jobHeading: string;
  jobDescription: string;
  frequencyType: string;
  frequencyInterval: string;
  frequencySource: string;
  jobType: string;
  responsibleRankPic: string;
  verifyingAuthority: string;
  vesselTypeApplicability: string;
  vesselTypes: string[];
  criticality: string;
  sourceModule: string;
  duplicateGroupId: string | null;
  isDuplicateKeeper: boolean;
  validationStatus: V41ValidationStatus;
  validationIssues: V41ValidationIssue[];
  activeFlag: boolean;
  routes: V41JobRoute[];
  budgetCategory: V41BudgetCategory;
  costCode: string;
  rfqSection: string;
  quoteComparisonSection: string;
  rfqGroup: string;
  overlayMatched: boolean;
  descriptionTruncated: boolean;
  repoJob: ParsedMasterJobRow;
  overlay?: V40JobMetadataOverlay;
};

export type V41BuildContext = {
  duplicateGroups: Map<string, string[]>;
  duplicateKeepers: Map<string, string>;
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function duplicateFingerprint(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay): string {
  const machinery = overlay?.machineryFamily || job.machinery;
  const component = overlay?.component || job.component;
  const heading = overlay?.jobHeading || job.standardJobName;
  const frequency = overlay?.frequencyType
    ? `${overlay.frequencyType}|${overlay.frequencyInterval}`
    : "";
  return [machinery, component, heading, frequency].map(normalizeText).join("||");
}

function deriveSourceModule(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay): string {
  if (overlay?.sourceModule) return overlay.sourceModule;
  const prefix = job.jobId.match(/^JOBS-([A-Z0-9]+)-/i)?.[1];
  const prefixMap: Record<string, string> = {
    ME: "V3_Main_Engine",
    AE: "V3_Auxiliary_Engine",
    BLR: "V3_Boilers",
    PMP: "V3_Pumps",
    CMP: "V3_Compressors",
    PUR: "V3_Purifiers",
    HEX: "V3_Heat_Exchangers",
    STG: "V3_Steering_Gear",
    DMK: "V3_Deck_Machinery",
    FLS: "V3_Fire_Fighting",
    LSA: "V3_Life_Saving",
    HULL: "V3_Hull_Structure",
    EPD: "V3_Electrical_Power",
    NAVCOM: "V3_Navigation_Communication",
  };
  if (prefix && prefixMap[prefix]) return prefixMap[prefix];
  return job.libraryVersion || "V3_Repository";
}

function formatVesselApplicability(types: string[]): string {
  if (types.length === 0 || types.includes("All Types")) return "All Types";
  if (types.some((t) => /applicable where fitted/i.test(t))) return "Applicable where fitted";
  return types.join("; ");
}

function normalizeVesselTypes(
  repoTypes: string[],
  overlayText?: string,
): { types: string[]; defaulted: boolean } {
  if (overlayText) {
    const lower = overlayText.toLowerCase();
    if (/^all$/.test(lower) || /all\s*\/\s*as fitted|all types|all vessels?/.test(lower)) {
      return { types: ["All Types"], defaulted: false };
    }
    if (/applicable where fitted|as fitted/i.test(lower)) {
      return { types: ["Applicable where fitted"], defaulted: false };
    }
    const parts = overlayText
      .split(/[;/,]/)
      .map((p) => {
        const trimmed = p.trim();
        if (/^all$/i.test(trimmed)) return "All Types";
        return trimmed;
      })
      .filter(Boolean);
    if (parts.length > 0) return { types: parts, defaulted: false };
  }
  if (repoTypes.length > 0) return { types: repoTypes, defaulted: false };
  return { types: ["All Types"], defaulted: true };
}

function mapCriticality(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay): string {
  if (overlay?.criticality) return overlay.criticality;
  switch (job.riskLevel) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Medium";
  }
}

function classifyRoutes(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay): V41JobRoute[] {
  const routes = new Set<V41JobRoute>();
  const hay = `${job.standardJobName} ${job.jobDescription} ${job.machinery} ${job.component}`.toLowerCase();
  const projectTypes = new Set(job.applicableProjectTypes);
  const overlayProject = (overlay?.projectSurveyType ?? "").toLowerCase();
  const overlayTrigger = (overlay?.triggerBasis ?? "").toLowerCase();

  const isStatutory =
    job.classHoldPoint ||
    /statutory|class survey|certificate|solas|ism|marpol|flag state/.test(hay) ||
    /statutory|class survey|certificate/.test(overlayProject);

  const isDryDock =
    overlay?.dryDockScope.toLowerCase() === "yes" ||
    projectTypes.has("special_survey" as DryDockProjectType) ||
    projectTypes.has("intermediate_survey" as DryDockProjectType) ||
    projectTypes.has("emergency_docking" as DryDockProjectType) ||
    projectTypes.has("underwater_survey" as DryDockProjectType) ||
    /dry dock|docking|hull survey|uw inspection|special survey/.test(hay) ||
    /dry dock|special survey|intermediate survey/.test(overlayProject);

  const isPms =
    projectTypes.has("occasional_repair" as DryDockProjectType) ||
    /pms|routine|running maintenance|maker manual/.test(overlayTrigger) ||
    /pms|routine/.test(overlayProject) ||
    (!isDryDock && !isStatutory && /check|inspect|monitor|test|overhaul/.test(hay));

  if (isStatutory) routes.add("Statutory");
  if (isDryDock) routes.add("Dry Dock");
  if (isPms) routes.add("PMS");

  if (routes.size === 0) {
    if (/hull|paint|dock|anode|coating|rudder|propeller|tail shaft/.test(hay)) routes.add("Dry Dock");
    else routes.add("PMS");
  }

  return [...routes];
}

function resolveFrequency(
  job: ParsedMasterJobRow,
  routes: V41JobRoute[],
  overlay?: V40JobMetadataOverlay,
): { type: string; interval: string; source: string } | null {
  if (overlay?.frequencyType && overlay.frequencyInterval) {
    return {
      type: overlay.frequencyType,
      interval: overlay.frequencyInterval,
      source: "V4 metadata overlay",
    };
  }

  if (routes.includes("PMS")) {
    if (job.riskLevel === "critical") return { type: "Months", interval: "1", source: "inferred-risk-critical" };
    if (job.riskLevel === "high") return { type: "Months", interval: "3", source: "inferred-risk-high" };
    return { type: "Months", interval: "6", source: "inferred-pms-default" };
  }
  if (routes.includes("Statutory")) {
    return { type: "Years", interval: "5", source: "inferred-statutory-cycle" };
  }
  if (routes.includes("Dry Dock")) {
    return { type: "Event", interval: "Dry Dock", source: "inferred-dry-dock-event" };
  }
  return null;
}

export function inferV41BudgetCategory(
  job: ParsedMasterJobRow,
  overlay?: V40JobMetadataOverlay,
): V41BudgetCategory {
  const raw = `${overlay?.rfqWorkshopCategory ?? ""} ${job.budgetCategory} ${job.rfqCategory} ${job.machinery} ${job.systemGroup} ${job.component}`;
  const hay = raw.toLowerCase();

  if (/dock|docking|keel block|berthing/.test(hay)) return "Docking Cost";
  if (/paint|coating|blasting|anode|hull treatment/.test(hay)) return "Hull Painting Cost";
  if (/class|survey|statutory|certificate|inspection fee/.test(hay) || job.classHoldPoint) {
    return "Class/Survey Cost";
  }
  if (/maker|attendance|oem representative|vendor witness/.test(hay) || job.makerAttendanceRequired) {
    return "Maker Attendance Cost";
  }
  if (/spare|gasket|seal|bearing|impeller|liner/.test(hay)) return "Spares Cost";
  if (/store|consumable|lube|oil|grease|chemical|filter element/.test(hay)) return "Stores/Consumables Cost";
  if (/agency|port|pilot|tug|waste disposal/.test(hay)) return "Agency/Port Cost";
  if (/electric|motor|generator|switchboard|battery|automation|ias/.test(hay) || job.department === "electrical") {
    return "Electrical Repair Cost";
  }
  if (/engineer|technician|superintendent|service attendance/.test(hay)) return "Service Engineer Cost";
  if (/machinery|engine|pump|compressor|boiler|purifier|gear|valve|piping/.test(hay)) {
    return "Machinery Repair Cost";
  }
  return "Miscellaneous";
}

function chooseDuplicateKeeper(jobIds: string[]): string {
  return [...jobIds].sort((a, b) => a.localeCompare(b))[0]!;
}

function resolveJobType(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay, routes?: V41JobRoute[]): string {
  if (overlay?.jobType) return overlay.jobType;
  if (routes?.includes("Statutory")) return "Statutory";
  if (routes?.includes("Dry Dock")) return "Dry Dock";
  if (job.classHoldPoint) return "Class Hold";
  return "Maintenance";
}

function resolveYardResponsibility(job: ParsedMasterJobRow, overlay?: V40JobMetadataOverlay): string {
  if (job.makerAttendanceRequired) return "Maker";
  if (job.workshop === "deck") return "Yard";
  if (/owner supply|owner furnished/i.test(overlay?.remarks ?? "")) return "Owner";
  if (job.workshop === "machinery") return "Yard";
  return "Yard / Owner per scope";
}

export function buildDuplicateContext(jobs: ParsedMasterJobRow[], overlays: Map<string, V40JobMetadataOverlay>): V41BuildContext {
  const duplicateGroups = new Map<string, string[]>();

  for (const job of jobs) {
    const overlay = overlays.get(job.jobId);
    const fingerprint = duplicateFingerprint(job, overlay);
    const group = duplicateGroups.get(fingerprint) ?? [];
    group.push(job.jobId);
    duplicateGroups.set(fingerprint, group);
  }

  const duplicateKeepers = new Map<string, string>();
  for (const [fingerprint, ids] of duplicateGroups) {
    if (ids.length > 1) duplicateKeepers.set(fingerprint, chooseDuplicateKeeper(ids));
  }

  return { duplicateGroups, duplicateKeepers };
}

export function normalizeV41Job(
  job: ParsedMasterJobRow,
  overlay: V40JobMetadataOverlay | undefined,
  context: V41BuildContext,
): V41NormalizedJob {
  const issues: V41ValidationIssue[] = [];
  const routes = classifyRoutes(job, overlay);
  const fingerprint = duplicateFingerprint(job, overlay);
  const groupIds = context.duplicateGroups.get(fingerprint) ?? [job.jobId];
  const duplicateGroupId = groupIds.length > 1 ? `DUP-${fingerprint.slice(0, 48).replace(/[^a-z0-9]+/gi, "-")}` : null;
  const keeperId = context.duplicateKeepers.get(fingerprint);
  const isDuplicateKeeper = !keeperId || keeperId === job.jobId;

  const machinery = overlay?.machineryFamily || job.machinery;
  const component = overlay?.component || job.component;
  const jobHeading = overlay?.jobHeading || job.standardJobName;
  let jobDescription = overlay?.jobDescription || job.jobDescription || job.standardJobName;
  let descriptionTruncated = false;
  if (jobDescription.length > V41_DESCRIPTION_MAX_LENGTH) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Warning",
      rule: "LONG_DESCRIPTION",
      field: "Job_Description",
      message: `Description truncated from ${jobDescription.length} to ${V41_DESCRIPTION_MAX_LENGTH} characters`,
      route: "All",
    });
    jobDescription = jobDescription.slice(0, V41_DESCRIPTION_MAX_LENGTH);
    descriptionTruncated = true;
  }

  if (!machinery) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Blocked",
      rule: "MISSING_MACHINERY",
      field: "Machinery",
      message: "Machinery is required for upload",
      route: "All",
    });
  }
  if (!component) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Blocked",
      rule: "MISSING_COMPONENT",
      field: "Component",
      message: "Component is required for upload",
      route: "All",
    });
  }

  const vessel = normalizeVesselTypes(job.applicableVesselTypes, overlay?.vesselTypeApplicability);
  if (vessel.defaulted) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Warning",
      rule: "MISSING_VESSEL_APPLICABILITY",
      field: "Vessel_Type_Applicability",
      message: "Vessel applicability missing — defaulted to All Types",
      route: "All",
    });
  }

  const responsibleRankPic = overlay?.pic || job.responsibleUserRole;
  if (!responsibleRankPic) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Warning",
      rule: "MISSING_RESPONSIBILITY",
      field: "Responsible_Rank_PIC",
      message: "Responsible rank / PIC missing",
      route: "All",
    });
  }

  const frequency = resolveFrequency(job, routes, overlay);
  if (routes.includes("PMS") && !frequency) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Blocked",
      rule: "MISSING_FREQUENCY",
      field: "Frequency_Type",
      message: "PMS route requires frequency — could not synthesize",
      route: "PMS",
    });
  } else if (routes.includes("PMS") && frequency?.source.startsWith("inferred")) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Warning",
      rule: "SYNTHESIZED_FREQUENCY",
      field: "Frequency_Type",
      message: `Frequency synthesized (${frequency.type} / ${frequency.interval}) from job risk/route`,
      route: "PMS",
    });
  }

  if (duplicateGroupId && !isDuplicateKeeper) {
    issues.push({
      canonicalJobId: job.jobId,
      severity: "Warning",
      rule: "DUPLICATE_NON_KEEPER",
      field: "Duplicate_Group_ID",
      message: `Duplicate of keeper ${keeperId}`,
      route: "All",
    });
  }

  const hasBlocked = issues.some((i) => i.severity === "Blocked");
  const hasWarning = issues.some((i) => i.severity === "Warning");
  const validationStatus: V41ValidationStatus = hasBlocked ? "Blocked" : hasWarning ? "Warning" : "Pass";

  const budgetCategory = inferV41BudgetCategory(job, overlay);
  const costCode = job.dryDockCostCode || budgetCategory.replace(/\s+/g, "-").slice(0, 24).toUpperCase();
  const rfqSection = job.rfqCategory && job.rfqCategory !== "No" ? job.rfqCategory : machinery;
  const quoteComparisonSection = job.budgetCategory || rfqSection;

  return {
    canonicalJobId: job.jobId,
    machinery,
    component,
    jobHeading,
    jobDescription,
    frequencyType: frequency?.type ?? "",
    frequencyInterval: frequency?.interval ?? "",
    frequencySource: frequency?.source ?? "",
    jobType: resolveJobType(job, overlay, routes),
    responsibleRankPic: responsibleRankPic || "Chief Engineer",
    verifyingAuthority: overlay?.verifyingAuthority || job.reviewRole || job.approvalRole || "Chief Engineer",
    vesselTypeApplicability: formatVesselApplicability(vessel.types),
    vesselTypes: vessel.types,
    criticality: mapCriticality(job, overlay),
    sourceModule: deriveSourceModule(job, overlay),
    duplicateGroupId,
    isDuplicateKeeper,
    validationStatus,
    validationIssues: issues,
    activeFlag: job.activeFlag,
    routes,
    budgetCategory,
    costCode,
    rfqSection,
    quoteComparisonSection,
    rfqGroup: rfqSection,
    overlayMatched: Boolean(overlay),
    descriptionTruncated,
    repoJob: job,
    overlay,
  };
}

export function buildImportLookups(jobs: V41NormalizedJob[]) {
  const machineryFamilies = [...new Set(jobs.map((j) => j.machinery).filter(Boolean))].sort();
  const responsibleRanks = [...new Set(jobs.map((j) => j.responsibleRankPic).filter(Boolean))].sort();
  const verifyingAuthorities = [...new Set(jobs.map((j) => j.verifyingAuthority).filter(Boolean))].sort();
  const rfqGroups = [...new Set(jobs.map((j) => j.rfqGroup).filter(Boolean))].sort();
  const costCodes = [...new Set(jobs.map((j) => j.costCode).filter(Boolean))].sort();
  const sourceModules = [...new Set(jobs.map((j) => j.sourceModule).filter(Boolean))].sort();

  const rows: Array<Record<string, string>> = [];
  const pushLookup = (category: string, value: string, notes = "") => {
    if (!value) return;
    rows.push({ Lookup_Category: category, Lookup_Value: value, Notes: notes });
  };

  for (const value of V41_VESSEL_TYPES) pushLookup("Vessel_Type", value);
  for (const value of V41_BUDGET_CATEGORIES) pushLookup("Budget_Category", value);
  for (const value of V41_JOB_ROUTES) pushLookup("Job_Route", value);
  for (const value of V41_VALIDATION_STATUSES) pushLookup("Validation_Status", value);
  for (const value of machineryFamilies) pushLookup("Machinery_Family", value);
  for (const value of responsibleRanks) pushLookup("Responsible_Rank_PIC", value);
  for (const value of verifyingAuthorities) pushLookup("Verifying_Authority", value);
  for (const value of rfqGroups.slice(0, 500)) pushLookup("RFQ_Group", value);
  for (const value of costCodes.slice(0, 500)) pushLookup("Cost_Code", value);
  for (const value of sourceModules) pushLookup("Source_Module", value);

  return rows;
}

export function buildVesselTypeFilterRows(jobs: V41NormalizedJob[]) {
  const rows: Array<Record<string, string>> = [];
  for (const job of jobs) {
    if (job.vesselTypes.includes("All Types") || job.vesselTypes.includes("Applicable where fitted")) {
      rows.push({
        Filter_Rule_ID: `FLT-${job.canonicalJobId}`,
        Canonical_Job_ID: job.canonicalJobId,
        Machinery_Family: job.machinery,
        Component: job.component,
        Vessel_Type: job.vesselTypeApplicability,
        Applicability: "Include",
        Rule_Source: job.overlayMatched ? "V4 overlay" : "Repo default",
        Notes: job.vesselTypeApplicability,
      });
      continue;
    }
    for (const vesselType of job.vesselTypes) {
      rows.push({
        Filter_Rule_ID: `FLT-${job.canonicalJobId}-${vesselType.replace(/[^A-Z0-9]+/gi, "").slice(0, 12)}`,
        Canonical_Job_ID: job.canonicalJobId,
        Machinery_Family: job.machinery,
        Component: job.component,
        Vessel_Type: vesselType,
        Applicability: "Include",
        Rule_Source: job.overlayMatched ? "V4 overlay" : "Repo",
        Notes: "",
      });
    }
  }
  return rows;
}

export function buildDuplicateControlRows(jobs: V41NormalizedJob[]) {
  const byGroup = new Map<string, V41NormalizedJob[]>();
  for (const job of jobs) {
    if (!job.duplicateGroupId) continue;
    const list = byGroup.get(job.duplicateGroupId) ?? [];
    list.push(job);
    byGroup.set(job.duplicateGroupId, list);
  }

  const rows: Array<Record<string, string>> = [];
  for (const [groupId, members] of byGroup) {
    const keeper = members.find((m) => m.isDuplicateKeeper) ?? members[0]!;
    for (const member of members) {
      rows.push({
        Duplicate_Group_ID: groupId,
        Canonical_Job_ID: member.canonicalJobId,
        Machinery: member.machinery,
        Component: member.component,
        Job_Heading: member.jobHeading,
        Frequency: `${member.frequencyType} ${member.frequencyInterval}`.trim(),
        Keeper_Job_ID: keeper.canonicalJobId,
        Is_Keeper: member.isDuplicateKeeper ? "Y" : "N",
        Member_Count: String(members.length),
        Validation_Status: member.validationStatus,
      });
    }
  }
  return rows;
}

export function buildValidationErrorRows(jobs: V41NormalizedJob[]): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const job of jobs) {
    for (const issue of job.validationIssues) {
      rows.push({
        Canonical_Job_ID: issue.canonicalJobId,
        Severity: issue.severity,
        Rule: issue.rule,
        Field: issue.field,
        Message: issue.message,
        Route: issue.route,
        Machinery: job.machinery,
        Component: job.component,
        Job_Heading: job.jobHeading,
      });
    }
  }
  return rows;
}

export function toPmsUploadRow(job: V41NormalizedJob): Record<string, string> {
  return {
    Canonical_Job_ID: job.canonicalJobId,
    Machinery: job.machinery,
    Component: job.component,
    Job_Heading: job.jobHeading,
    Job_Description: job.jobDescription,
    Frequency_Type: job.frequencyType,
    Frequency_Interval: job.frequencyInterval,
    Job_Type: job.jobType,
    Responsible_Rank_PIC: job.responsibleRankPic,
    Verifying_Authority: job.verifyingAuthority,
    Vessel_Type_Applicability: job.vesselTypeApplicability,
    Criticality: job.criticality,
    Source_Module: job.sourceModule,
    Duplicate_Group_ID: job.duplicateGroupId ?? "",
    Validation_Status: job.validationStatus,
    Active_Flag: job.activeFlag ? "Y" : "N",
  };
}

export function toDryDockRfqRow(job: V41NormalizedJob): Record<string, string> {
  const repo = job.repoJob;
  return {
    Canonical_Job_ID: job.canonicalJobId,
    RFQ_Group: job.rfqGroup,
    Machinery_System: job.machinery,
    Job_Scope: job.jobDescription || job.jobHeading,
    UOM: repo.standardManHours ? "Manhours" : "Lump Sum",
    Quantity_Basis: repo.standardManHours ? String(repo.standardManHours) : "1",
    Yard_Owner_Maker_Responsibility: resolveYardResponsibility(repo, job.overlay),
    Inspection_Requirement: repo.inspectionChecklistId ? "Checklist required" : "Visual / operational check",
    Test_Requirement: repo.classHoldPoint ? "Class witnessed test" : "Operational test as applicable",
    Class_Attendance: repo.classHoldPoint ? "Yes" : job.routes.includes("Statutory") ? "Survey attendance" : "No",
    Remarks: job.overlay?.remarks || repo.remarks || "",
  };
}

export function toBudgetMappingRow(job: V41NormalizedJob): Record<string, string> {
  return {
    Canonical_Job_ID: job.canonicalJobId,
    Budget_Category: job.budgetCategory,
    Cost_Code: job.costCode,
    RFQ_Section: job.rfqSection,
    Quote_Comparison_Section: job.quoteComparisonSection,
  };
}
