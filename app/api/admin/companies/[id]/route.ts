import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { companyUpdateSchema, parseBody, statusBodySchema } from "@/lib/admin/validation";
import {
  deleteCompany,
  getCompany,
  setCompanyStatus,
  updateCompany,
} from "@/lib/db/companies";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const company = await getCompany(id);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(companyUpdateSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getCompany(id);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const data = parsed.data;
  const company = await updateCompany(id, {
    ...data,
    contactEmail: data.contactEmail === "" ? null : data.contactEmail,
  });
  return NextResponse.json({ company });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(statusBodySchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getCompany(id);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const company = await setCompanyStatus(id, parsed.data.status);
  return NextResponse.json({ company });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await getCompany(id);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await deleteCompany(id);
  return NextResponse.json({ ok: true });
}
