import { NextResponse } from "next/server";
import { ACTINIUM_APP_ID, ACTINIUM_APP_NAME } from "@/lib/app-identity";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

/** Public identity probe — lets the dev launcher distinguish Actinium-DD from other apps on the same port. */
export async function GET() {
  return NextResponse.json(
    {
      appId: ACTINIUM_APP_ID,
      appName: ACTINIUM_APP_NAME,
      version: packageJson.version,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Actinium-App": ACTINIUM_APP_ID,
      },
    },
  );
}
