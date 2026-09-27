export const MACHINERY_REGISTER_DEPARTMENTS = [
  "Machinery",
  "Electrical",
  "Deck",
  "Hull",
  "Other",
] as const;

export const MACHINERY_REGISTER_IMPORT_COLUMNS = {
  name: "Machinery name",
  maker: "Make",
  model: "Model",
  serialNumber: "Serial number",
  units: "Units",
  location: "Location",
  department: "Department / category",
  notes: "Notes",
  status: "Status",
} as const;

export type MachineryRegisterImportColumnKey = keyof typeof MACHINERY_REGISTER_IMPORT_COLUMNS;

export type MachineryRegisterImportRow = {
  name: string;
  maker: string;
  model: string;
  serialNumber: string;
  units: string;
  location: string;
  department: string;
  notes: string;
  isActive: boolean;
  /** 1-based Excel row number (for error messages). */
  sourceRow: number;
};

export function normalizeMachineryDepartment(raw: string): string {
  const t = raw.trim();
  if (!t) return "Machinery";
  const hit = MACHINERY_REGISTER_DEPARTMENTS.find(
    (d) => d.toLowerCase() === t.toLowerCase(),
  );
  return hit ?? t;
}

export function machineryDuplicateKey(name: string, serialNumber: string): string {
  return `${name.trim().toLowerCase()}::${serialNumber.trim().toLowerCase()}`;
}

export function validateMachineryImportRow(
  row: MachineryRegisterImportRow,
  opts?: {
    existingKeys?: Set<string>;
    draftKeys?: Set<string>;
  },
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.name.trim()) {
    errors.push("Machinery name is required");
  }

  const dept = row.department.trim();
  if (
    dept &&
    !MACHINERY_REGISTER_DEPARTMENTS.some((d) => d.toLowerCase() === dept.toLowerCase())
  ) {
    warnings.push(`Unknown department "${dept}" — will be saved as entered`);
  }

  const key = machineryDuplicateKey(row.name, row.serialNumber);
  if (row.name.trim() && opts?.existingKeys?.has(key)) {
    warnings.push("Possible duplicate of an existing register entry (same name + serial)");
  }
  if (row.name.trim() && opts?.draftKeys?.has(key)) {
    warnings.push("Duplicate of another row in this import (same name + serial)");
  }

  return { errors, warnings };
}
