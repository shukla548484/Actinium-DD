import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import {
  formatFxRate,
  resolveMarketOrFallbackLocalPerUsd,
} from "@/lib/fx/rates";

export type ResolvedProjectFx = {
  localCurrency: string;
  localPerUsd: number;
  source: "project_manual" | "market_30d_avg" | "fallback";
  marketAvgLocalPerUsd: number | null;
  dryDockProjectId: string | null;
  projectId: string | null;
  label: string;
  rateLabel: string;
};

export async function getProjectCurrencyConversion(query: {
  dryDockProjectId?: string | null;
  projectId?: string | null;
}) {
  if (query.dryDockProjectId) {
    const row = await prisma.projectCurrencyConversion.findFirst({
      where: { dryDockProjectId: query.dryDockProjectId, ...notDeleted },
    });
    if (row) return row;
  }
  if (query.projectId) {
    return prisma.projectCurrencyConversion.findFirst({
      where: { projectId: query.projectId, ...notDeleted },
    });
  }
  return null;
}

/** Prefer Purchase-defined project rate; otherwise 30-day market average (or static fallback). */
export async function resolveFxForQuote(input: {
  localCurrency: string;
  dryDockProjectId?: string | null;
  projectId?: string | null;
}): Promise<ResolvedProjectFx> {
  const localCurrency = input.localCurrency.trim().toUpperCase() || "USD";
  const stored = await getProjectCurrencyConversion({
    dryDockProjectId: input.dryDockProjectId,
    projectId: input.projectId,
  });

  if (stored && stored.localCurrency.toUpperCase() === localCurrency) {
    return {
      localCurrency,
      localPerUsd: stored.localPerUsd,
      source: stored.source === "market_30d_avg" ? "market_30d_avg" : "project_manual",
      marketAvgLocalPerUsd: stored.marketAvgLocalPerUsd,
      dryDockProjectId: stored.dryDockProjectId,
      projectId: stored.projectId,
      label: stored.source === "market_30d_avg" ? "30-day market average" : "Project rate (Purchase)",
      rateLabel: formatFxRate(stored.localPerUsd, localCurrency),
    };
  }

  const market = await resolveMarketOrFallbackLocalPerUsd(localCurrency, 30);
  return {
    localCurrency,
    localPerUsd: market.localPerUsd,
    source: market.source === "market_30d_avg" ? "market_30d_avg" : "fallback",
    marketAvgLocalPerUsd: market.localPerUsd,
    dryDockProjectId: input.dryDockProjectId ?? null,
    projectId: input.projectId ?? null,
    label:
      market.source === "market_30d_avg"
        ? "30-day market average (internet)"
        : "Fallback rate",
    rateLabel: formatFxRate(market.localPerUsd, localCurrency),
  };
}

export async function listDryDockProjectsForCurrencyPage() {
  return prisma.dryDockProject.findMany({
    where: { ...notDeleted },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      referenceCode: true,
      currency: true,
      status: true,
      vessel: { select: { id: true, name: true, code: true } },
      projectId: true,
      currencyConversion: true,
    },
  });
}

export async function upsertProjectCurrencyConversion(input: {
  dryDockProjectId?: string | null;
  projectId?: string | null;
  localCurrency: string;
  localPerUsd: number;
  source: "manual" | "market_30d_avg";
  notes?: string | null;
  updatedByName?: string | null;
  useMarketAverage?: boolean;
}) {
  if (!input.dryDockProjectId && !input.projectId) {
    return { ok: false as const, error: "Select a project", status: 400 as const };
  }

  const localCurrency = input.localCurrency.trim().toUpperCase();
  let localPerUsd = input.localPerUsd;
  let source = input.source;
  let marketAvg: number | null = null;
  let marketFetchedAt: Date | null = null;

  if (input.useMarketAverage || source === "market_30d_avg") {
    const market = await resolveMarketOrFallbackLocalPerUsd(localCurrency, 30);
    localPerUsd = market.localPerUsd;
    source = market.source === "market_30d_avg" ? "market_30d_avg" : "manual";
    marketAvg = market.localPerUsd;
    marketFetchedAt = new Date();
  } else {
    const market = await resolveMarketOrFallbackLocalPerUsd(localCurrency, 30);
    marketAvg = market.localPerUsd;
    marketFetchedAt = new Date();
  }

  if (!(localPerUsd > 0)) {
    return { ok: false as const, error: "Rate must be positive", status: 400 as const };
  }

  const existing = await getProjectCurrencyConversion({
    dryDockProjectId: input.dryDockProjectId,
    projectId: input.projectId,
  });

  const data = {
    localCurrency,
    localPerUsd,
    source,
    marketAvgLocalPerUsd: marketAvg,
    marketFetchedAt,
    notes: input.notes?.trim() || null,
    updatedByName: input.updatedByName?.trim() || null,
    dryDockProjectId: input.dryDockProjectId ?? null,
    projectId: input.projectId ?? null,
    deletedAt: null,
  };

  const row = existing
    ? await prisma.projectCurrencyConversion.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.projectCurrencyConversion.create({ data });

  return { ok: true as const, conversion: row };
}
