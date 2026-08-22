import { NextResponse } from "next/server";
import { getShipyardQuoteBundledTables } from "@/lib/i18n/shipyardQuotationUi";

/**
 * Public language packs for the shipyard module.
 * Clients cache the payload in localStorage for offline use.
 */
export async function GET() {
  const packs = getShipyardQuoteBundledTables();
  return NextResponse.json(
    {
      version: packs.en.packVersion ?? "1",
      updatedAt: new Date().toISOString(),
      packs,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    },
  );
}
