import { NextResponse } from "next/server";
import { resolveFxForQuote } from "@/lib/db/projectCurrency";
import { LOCALE_DEFAULT_CURRENCY } from "@/lib/fx/rates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public-ish FX resolve for shipyard banner (auth optional; used after login in module). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const localCurrency =
    url.searchParams.get("localCurrency")?.toUpperCase() ||
    LOCALE_DEFAULT_CURRENCY[url.searchParams.get("locale") ?? ""] ||
    "KRW";
  const dryDockProjectId = url.searchParams.get("dryDockProjectId");
  const projectId = url.searchParams.get("projectId");

  const fx = await resolveFxForQuote({
    localCurrency,
    dryDockProjectId,
    projectId,
  });

  return NextResponse.json({ fx });
}
