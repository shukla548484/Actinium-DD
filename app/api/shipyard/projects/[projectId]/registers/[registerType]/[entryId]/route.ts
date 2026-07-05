import { NextResponse } from "next/server";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import {
  deleteYardRegisterEntry,
  updateYardRegisterEntry,
} from "@/lib/db/yardRegisters";
import { isYardRegisterType } from "@/lib/shipyard/registerTypes";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ projectId: string; registerType: string; entryId: string }> },
) {
  const denied = await requireShipyardApiAccess(req);
  if (denied) return denied;

  try {
    const { projectId, registerType, entryId } = await ctx.params;
    if (!isYardRegisterType(registerType)) {
      return NextResponse.json({ error: "Unknown register type" }, { status: 400 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const entry = await updateYardRegisterEntry(registerType, projectId, entryId, body);
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; registerType: string; entryId: string }> },
) {
  const denied = await requireShipyardApiAccess(_req);
  if (denied) return denied;

  try {
    const { projectId, registerType, entryId } = await ctx.params;
    if (!isYardRegisterType(registerType)) {
      return NextResponse.json({ error: "Unknown register type" }, { status: 400 });
    }
    await deleteYardRegisterEntry(registerType, projectId, entryId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 },
    );
  }
}
