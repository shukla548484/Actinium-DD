import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { importJobCatalogFromWorkbook } from "@/lib/mtil/import/importJobCatalogWorkbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const modeRaw = formData.get("mode");
  const mode = modeRaw === "merge" ? "merge" : "replace";

  const bytes = await file.arrayBuffer();
  const result = await importJobCatalogFromWorkbook(bytes, { mode });

  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  return NextResponse.json(result, { status: 201 });
}
