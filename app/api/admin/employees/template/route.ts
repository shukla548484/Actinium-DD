import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  buildEmployeeExportWorkbook,
  buildEmptyEmployeeTemplateWorkbook,
} from "@/lib/admin/employeeExcel";
import { listEmployeesForExport } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "current";
  const companyId = searchParams.get("companyId") ?? undefined;

  let buffer: Buffer;
  let filename: string;

  if (mode === "empty") {
    buffer = buildEmptyEmployeeTemplateWorkbook();
    filename = "employee-import-template.xlsx";
  } else {
    const rows = await listEmployeesForExport(companyId);
    buffer = buildEmployeeExportWorkbook(rows);
    filename = companyId ? `employees-export.xlsx` : "employees-export.xlsx";
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
