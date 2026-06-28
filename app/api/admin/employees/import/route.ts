import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { readEmployeeImportWorkbook } from "@/lib/admin/employeeExcel";
import { importEmployees } from "@/lib/db/employees";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const { parsed, errors: parseErrors } = readEmployeeImportWorkbook(await file.arrayBuffer());
  if (parsed.length === 0 && parseErrors.length === 0) {
    return NextResponse.json({ error: "Spreadsheet has no employee rows." }, { status: 400 });
  }
  if (parsed.length === 0) {
    return NextResponse.json(
      {
        error: "No valid employee rows found.",
        errors: parseErrors,
      },
      { status: 400 },
    );
  }

  const result = await importEmployees(parsed);
  const allErrors = [...parseErrors, ...result.errors];

  return NextResponse.json({
    imported: result.imported,
    skipped: result.skipped + parseErrors.length,
    employeeIds: result.employeeIds,
    errors: allErrors,
  });
}
