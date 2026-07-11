import type { V41ParsedUploadWorkbook, V41PmsUploadRow } from "@/lib/emdr/v4/parseV41UploadReady";
import { V41_FREQUENCY_TYPES } from "@/lib/emdr/v4/constants";

export type V41ValidationError = {
  sheet: string;
  row?: number;
  canonicalJobId?: string;
  rule: string;
  message: string;
};

export type V41ValidationResult = {
  valid: boolean;
  errors: V41ValidationError[];
  warnings: V41ValidationError[];
  summary: {
    pmsRows: number;
    dryDockRfqRows: number;
    budgetRows: number;
    pmsPass: number;
    pmsWarning: number;
    pmsBlocked: number;
    pmsActive: number;
    uniqueCanonicalIds: {
      pms: number;
      dryDockRfq: number;
      budget: number;
    };
    crossSheetOverlap: {
      pmsAndRfq: number;
      pmsAndBudget: number;
      rfqAndBudget: number;
      allThree: number;
    };
  };
};

function duplicateIds(rows: Array<{ canonicalJobId: string; rowNumber: number }>, sheet: string): V41ValidationError[] {
  const seen = new Map<string, number>();
  const errors: V41ValidationError[] = [];
  for (const row of rows) {
    const first = seen.get(row.canonicalJobId);
    if (first != null) {
      errors.push({
        sheet,
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "duplicate_canonical_id",
        message: `Duplicate Canonical_Job_ID ${row.canonicalJobId} (first seen row ${first})`,
      });
    } else {
      seen.set(row.canonicalJobId, row.rowNumber);
    }
  }
  return errors;
}

function requiredPmsFields(row: V41PmsUploadRow): V41ValidationError[] {
  const errors: V41ValidationError[] = [];
  const required: Array<[keyof V41PmsUploadRow, string]> = [
    ["machinery", "Machinery"],
    ["component", "Component"],
    ["jobHeading", "Job_Heading"],
    ["jobDescription", "Job_Description"],
  ];

  for (const [field, label] of required) {
    if (!cellStr(row[field])) {
      errors.push({
        sheet: "PMS_Upload_Ready",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "required_field",
        message: `${label} is required`,
      });
    }
  }
  return errors;
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count++;
  }
  return count;
}

export function validateV41UploadReady(
  data: V41ParsedUploadWorkbook,
  options: { existingJobIds?: Set<string> } = {},
): V41ValidationResult {
  const errors: V41ValidationError[] = [];
  const warnings: V41ValidationError[] = [];

  errors.push(...duplicateIds(data.pmsRows, "PMS_Upload_Ready"));
  errors.push(...duplicateIds(data.dryDockRfqRows, "DryDock_RFQ_Ready"));
  errors.push(...duplicateIds(data.budgetRows, "Budget_Cost_Code_Mapping"));

  for (const row of data.pmsRows) {
    errors.push(...requiredPmsFields(row));
    if (
      row.frequencyType &&
      !(V41_FREQUENCY_TYPES as readonly string[]).includes(row.frequencyType)
    ) {
      warnings.push({
        sheet: "PMS_Upload_Ready",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "nonstandard_frequency_type",
        message: `Non-standard Frequency_Type "${row.frequencyType}" — accepted for import`,
      });
    }
    if (row.validationStatus === "Blocked") {
      warnings.push({
        sheet: "PMS_Upload_Ready",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "blocked_status",
        message: "Row marked Blocked — will be skipped on import",
      });
    }
  }

  for (const row of data.dryDockRfqRows) {
    if (!row.rfqGroup) {
      errors.push({
        sheet: "DryDock_RFQ_Ready",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "required_field",
        message: "RFQ_Group is required",
      });
    }
    if (!row.jobScope) {
      errors.push({
        sheet: "DryDock_RFQ_Ready",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "required_field",
        message: "Job_Scope is required",
      });
    }
  }

  for (const row of data.budgetRows) {
    if (!row.rfqSection) {
      errors.push({
        sheet: "Budget_Cost_Code_Mapping",
        row: row.rowNumber,
        canonicalJobId: row.canonicalJobId,
        rule: "required_field",
        message: "RFQ_Section is required",
      });
    }
  }

  if (data.exportVersion && data.exportVersion !== "V4.1") {
    warnings.push({
      sheet: "Export_Summary",
      rule: "export_version",
      message: `Expected export version V4.1, found ${data.exportVersion}`,
    });
  }

  const existingJobIds = options.existingJobIds;
  if (existingJobIds) {
    for (const row of data.budgetRows) {
      if (!existingJobIds.has(row.canonicalJobId)) {
        warnings.push({
          sheet: "Budget_Cost_Code_Mapping",
          row: row.rowNumber,
          canonicalJobId: row.canonicalJobId,
          rule: "unknown_job_id",
          message: `Canonical_Job_ID ${row.canonicalJobId} not found in masterJobLibrary`,
        });
      }
    }
  }

  const pmsIds = new Set(data.pmsRows.map((r) => r.canonicalJobId));
  const rfqIds = new Set(data.dryDockRfqRows.map((r) => r.canonicalJobId));
  const budgetIds = new Set(data.budgetRows.map((r) => r.canonicalJobId));

  const pmsPass = data.pmsRows.filter((r) => r.validationStatus === "Pass").length;
  const pmsWarning = data.pmsRows.filter((r) => r.validationStatus === "Warning").length;
  const pmsBlocked = data.pmsRows.filter((r) => r.validationStatus === "Blocked").length;
  const pmsActive = data.pmsRows.filter((r) => r.activeFlag).length;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      pmsRows: data.pmsRows.length,
      dryDockRfqRows: data.dryDockRfqRows.length,
      budgetRows: data.budgetRows.length,
      pmsPass,
      pmsWarning,
      pmsBlocked,
      pmsActive,
      uniqueCanonicalIds: {
        pms: pmsIds.size,
        dryDockRfq: rfqIds.size,
        budget: budgetIds.size,
      },
      crossSheetOverlap: {
        pmsAndRfq: overlapCount(pmsIds, rfqIds),
        pmsAndBudget: overlapCount(pmsIds, budgetIds),
        rfqAndBudget: overlapCount(rfqIds, budgetIds),
        allThree: [...pmsIds].filter((id) => rfqIds.has(id) && budgetIds.has(id)).length,
      },
    },
  };
}
