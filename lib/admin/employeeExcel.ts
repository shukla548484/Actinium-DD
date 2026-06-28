import * as XLSX from "xlsx";
import type { EntityStatus } from "@prisma/client";
import { DESIGNATION_OPTIONS } from "@/lib/admin/designations";
import { formatPhoneE164, isValidLocalPhoneNumber, PHONE_E164_REGEX } from "@/lib/admin/phone";

export const EMPLOYEE_SHEET = "Employees";
export const DESIGNATIONS_SHEET = "Designations";

export const EMPLOYEE_IMPORT_HEADERS = [
  "Company",
  "First Name",
  "Last Name",
  "Email",
  "Country Code",
  "Phone",
  "Designation",
  "Department",
  "Status",
] as const;

export const EMPLOYEE_EXPORT_HEADERS = ["Employee Code", ...EMPLOYEE_IMPORT_HEADERS] as const;

export type EmployeeExportRow = {
  employeeCode: string;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phoneLocal: string;
  designation: string | null;
  department: string | null;
  status: EntityStatus;
};

export type ParsedEmployeeImportRow = {
  rowNumber: number;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department: string | null;
  status: EntityStatus;
};

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().replace(/[_\s]+/g, " ");
    if (keys.some((k) => lower.includes(k))) return cellStr(row[key]);
  }
  return "";
}

function normalizeStatus(raw: string): EntityStatus | null {
  const lower = raw.toLowerCase();
  if (!lower || lower === "waiting" || lower === "wait") return "wait";
  if (lower === "active") return "active";
  if (lower === "inactive") return "inactive";
  return null;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function buildPhone(countryCode: string, local: string): string | null {
  const dial = countryCode.replace(/\D/g, "");
  const digits = local.replace(/\D/g, "");
  if (!dial || !isValidLocalPhoneNumber(digits)) return null;
  const phone = formatPhoneE164(dial, digits);
  return PHONE_E164_REGEX.test(phone) ? phone : null;
}

export function employeeToExportRow(employee: {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  status: EntityStatus;
  company: { name: string };
}): EmployeeExportRow {
  const e164 = employee.phone?.match(/^\+(\d{1,4})(\d{10})$/);
  return {
    employeeCode: employee.employeeCode,
    companyName: employee.company.name,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    countryCode: e164?.[1] ?? "91",
    phoneLocal: e164?.[2] ?? "",
    designation: employee.designation,
    department: employee.department,
    status: employee.status,
  };
}

function exportRowToArray(row: EmployeeExportRow, includeCode: boolean): (string | number)[] {
  const base = [
    row.companyName,
    row.firstName,
    row.lastName,
    row.email,
    row.countryCode,
    row.phoneLocal,
    row.designation ?? "",
    row.department ?? "",
    row.status,
  ];
  return includeCode ? [row.employeeCode, ...base] : base;
}

function buildDesignationsSheet(): XLSX.WorkSheet {
  const data: string[][] = [["Designation", "Department", "Role Code"]];
  for (const option of DESIGNATION_OPTIONS) {
    data.push([option.label, option.department, option.roleCode]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 14 }];
  return ws;
}

export function buildEmptyEmployeeTemplateWorkbook(): Buffer {
  const example: EmployeeExportRow = {
    employeeCode: "",
    companyName: "ABCD Ship Management",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    countryCode: "91",
    phoneLocal: "9876543210",
    designation: "Technical Superintendent",
    department: "Technical",
    status: "wait",
  };

  const wb = XLSX.utils.book_new();
  const data: (string | number)[][] = [
    [...EMPLOYEE_IMPORT_HEADERS],
    exportRowToArray(example, false),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = EMPLOYEE_IMPORT_HEADERS.map((header) => ({
    wch: header === "Company" || header === "Designation" ? 28 : 18,
  }));
  XLSX.utils.book_append_sheet(wb, ws, EMPLOYEE_SHEET);
  XLSX.utils.book_append_sheet(wb, buildDesignationsSheet(), DESIGNATIONS_SHEET);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildEmployeeExportWorkbook(rows: EmployeeExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const data: (string | number)[][] = [
    [...EMPLOYEE_EXPORT_HEADERS],
    ...rows.map((row) => exportRowToArray(row, true)),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = EMPLOYEE_EXPORT_HEADERS.map((header) => ({
    wch: header === "Company" || header === "Designation" ? 28 : 18,
  }));
  XLSX.utils.book_append_sheet(wb, ws, EMPLOYEE_SHEET);
  XLSX.utils.book_append_sheet(wb, buildDesignationsSheet(), DESIGNATIONS_SHEET);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseEmployeeImportRows(
  rows: Record<string, unknown>[],
  startRow = 2,
): { parsed: ParsedEmployeeImportRow[]; errors: { row: number; message: string }[] } {
  const parsed: ParsedEmployeeImportRow[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = startRow + index;

    const companyName = pickField(row, ["company"]);
    const firstName = pickField(row, ["first name", "firstname", "first"]);
    const lastName = pickField(row, ["last name", "lastname", "last", "surname"]);
    const emailRaw = pickField(row, ["email", "e-mail"]);
    const countryCode = pickField(row, ["country code", "dial code", "country"]);
    const phoneLocal = pickField(row, ["phone", "mobile", "tel"]);
    const designation = pickField(row, ["designation", "role", "title"]);
    const departmentRaw = pickField(row, ["department", "dept"]);
    const statusRaw = pickField(row, ["status"]);

    const isEmpty =
      !companyName &&
      !firstName &&
      !lastName &&
      !emailRaw &&
      !phoneLocal &&
      !designation;
    if (isEmpty) return;

    const email = normalizeEmail(emailRaw);
    if (!firstName || !lastName) {
      errors.push({ row: rowNumber, message: "First name and last name are required" });
      return;
    }
    if (!companyName) {
      errors.push({ row: rowNumber, message: "Company is required" });
      return;
    }
    if (!isValidEmail(email)) {
      errors.push({ row: rowNumber, message: "Valid email is required" });
      return;
    }
    if (!designation) {
      errors.push({ row: rowNumber, message: "Designation is required" });
      return;
    }

    const designationMatch = DESIGNATION_OPTIONS.find(
      (d) => d.label.toLowerCase() === designation.toLowerCase(),
    );
    if (!designationMatch) {
      errors.push({
        row: rowNumber,
        message: `Unknown designation "${designation}". Use the Designations sheet.`,
      });
      return;
    }

    const phone = buildPhone(countryCode || "91", phoneLocal);
    if (!phone) {
      errors.push({
        row: rowNumber,
        message: "Phone must be country code + 10-digit number",
      });
      return;
    }

    const status = statusRaw ? normalizeStatus(statusRaw) : "wait";
    if (statusRaw && !status) {
      errors.push({ row: rowNumber, message: "Status must be active, wait, or inactive" });
      return;
    }

    parsed.push({
      rowNumber,
      companyName,
      firstName,
      lastName,
      email,
      phone,
      designation: designationMatch.label,
      department: departmentRaw || designationMatch.department,
      status: status ?? "wait",
    });
  });

  return { parsed, errors };
}

export function readEmployeeImportWorkbook(buffer: ArrayBuffer): {
  parsed: ParsedEmployeeImportRow[];
  errors: { row: number; message: string }[];
} {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === EMPLOYEE_SHEET.toLowerCase()) ??
    workbook.SheetNames[0];
  if (!sheetName) {
    return { parsed: [], errors: [{ row: 0, message: "Workbook has no sheets" }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return parseEmployeeImportRows(rows);
}
