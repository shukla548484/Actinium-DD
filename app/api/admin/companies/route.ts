import { NextResponse } from "next/server";
import type { EntityStatus } from "@prisma/client";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  companyCreateSchema,
  parseBody,
} from "@/lib/admin/validation";
import {
  createCompany,
  listCompanies,
  listCompaniesForSelect,
} from "@/lib/db/companies";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("select") === "1") {
    const companies = await listCompaniesForSelect(searchParams.get("activeOnly") !== "0");
    return NextResponse.json({ companies });
  }

  const status = searchParams.get("status") as EntityStatus | "all" | null;
  const category = searchParams.get("category") as import("@prisma/client").CompanyCategory | null;
  const result = await listCompanies({
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 20),
    search: searchParams.get("search") ?? undefined,
    status: status && status !== "all" ? status : undefined,
    category: category ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const parsed = parseBody(companyCreateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data = parsed.data;
  const company = await createCompany({
    ...data,
    contactEmail: data.contactEmail || null,
  });
  return NextResponse.json({ company }, { status: 201 });
}
