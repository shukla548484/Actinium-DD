import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePurchaseApiAccess } from "@/lib/auth/purchaseAccess";
import {
  listDryDockProjectsForCurrencyPage,
  upsertProjectCurrencyConversion,
} from "@/lib/db/projectCurrency";
import { resolveMarketOrFallbackLocalPerUsd } from "@/lib/fx/rates";
import { parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const upsertSchema = z.object({
  dryDockProjectId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  localCurrency: z.string().min(3).max(3),
  localPerUsd: z.number().positive().optional(),
  useMarketAverage: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  updatedByName: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.budget");
  if ("denied" in access) return access.denied;

  const url = new URL(request.url);
  const previewCurrency = url.searchParams.get("previewCurrency");
  if (previewCurrency) {
    const market = await resolveMarketOrFallbackLocalPerUsd(previewCurrency, 30);
    return NextResponse.json({ market });
  }

  const projects = await listDryDockProjectsForCurrencyPage();
  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      referenceCode: p.referenceCode,
      status: p.status,
      currency: p.currency,
      projectId: p.projectId,
      vessel: p.vessel,
      conversion: p.currencyConversion
        ? {
            id: p.currencyConversion.id,
            localCurrency: p.currencyConversion.localCurrency,
            localPerUsd: p.currencyConversion.localPerUsd,
            source: p.currencyConversion.source,
            marketAvgLocalPerUsd: p.currencyConversion.marketAvgLocalPerUsd,
            marketFetchedAt: p.currencyConversion.marketFetchedAt?.toISOString() ?? null,
            notes: p.currencyConversion.notes,
            updatedAt: p.currencyConversion.updatedAt.toISOString(),
          }
        : null,
    })),
  });
}

export async function POST(request: Request) {
  const access = await requirePurchaseApiAccess("page.purchase.budget");
  if ("denied" in access) return access.denied;

  const parsed = parseBody(upsertSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const useMarket = parsed.data.useMarketAverage === true || parsed.data.localPerUsd == null;
  const result = await upsertProjectCurrencyConversion({
    dryDockProjectId: parsed.data.dryDockProjectId,
    projectId: parsed.data.projectId,
    localCurrency: parsed.data.localCurrency,
    localPerUsd: parsed.data.localPerUsd ?? 1,
    source: useMarket ? "market_30d_avg" : "manual",
    useMarketAverage: useMarket,
    notes: parsed.data.notes,
    updatedByName: parsed.data.updatedByName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ conversion: result.conversion });
}
