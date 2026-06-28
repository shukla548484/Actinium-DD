import { NextResponse } from "next/server";
import {
  createYardRegisterEntry,
  listYardRegisterEntries,
} from "@/lib/db/yardRegisters";
import { isYardRegisterType } from "@/lib/shipyard/registerTypes";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; registerType: string }> },
) {
  const { projectId, registerType } = await ctx.params;
  if (!isYardRegisterType(registerType)) {
    return NextResponse.json({ error: "Unknown register type" }, { status: 400 });
  }
  const entries = await listYardRegisterEntries(registerType, projectId);
  return NextResponse.json({ entries });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; registerType: string }> },
) {
  try {
    const { projectId, registerType } = await ctx.params;
    if (!isYardRegisterType(registerType)) {
      return NextResponse.json({ error: "Unknown register type" }, { status: 400 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const entry = await createYardRegisterEntry(registerType, projectId, body);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 },
    );
  }
}
