import { NextResponse } from "next/server";
import { localeFromCountryCode } from "@/lib/i18n/detectShipyardLocale";

function countryFromHeaders(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-ipcountry"),
    headers.get("x-vercel-ip-country"),
    headers.get("x-country-code"),
    headers.get("cloudfront-viewer-country"),
  ];
  for (const value of candidates) {
    if (!value) continue;
    const code = value.trim().toUpperCase();
    if (code && code !== "XX" && code !== "T1") return code;
  }
  return null;
}

/**
 * Best-effort location → language hint from CDN/geo headers.
 * Falls back to null when the host does not provide country (e.g. local dev).
 */
export async function GET(request: Request) {
  const country = countryFromHeaders(request.headers);
  const locale = localeFromCountryCode(country);
  return NextResponse.json({
    country,
    locale,
    source: country ? "ip-header" : "none",
  });
}
