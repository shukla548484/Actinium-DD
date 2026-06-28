import { NextResponse } from "next/server";
import {
  getYardQuoteByToken,
  replaceQuoteLines,
  updateInviteStatus,
  upsertQuoteMeta,
} from "@/lib/db/index";
import { resolveSpecDescription } from "@/lib/i18n/scope";
import {
  recalculateInviteLines,
  recalculateQuoteMetaTotals,
} from "@/lib/tender/buildHybridComparison";
import { buildQuoteLinesFromPortalDraft } from "@/lib/tender/matchExcelToSpec";
import type { PricingStatus } from "@/lib/tender/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const detail = await getYardQuoteByToken(token);
  if (!detail) {
    return NextResponse.json({ error: "Invalid or expired quote link." }, { status: 404 });
  }
  return NextResponse.json({ quote: detail });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const detail = await getYardQuoteByToken(token);
  if (!detail) {
    return NextResponse.json({ error: "Invalid or expired quote link." }, { status: 404 });
  }

  const body = (await request.json()) as {
    submit?: boolean;
    meta?: {
      currency?: string;
      exchangeRate?: number | null;
      validityDays?: number | null;
      generalNotes?: string | null;
      globalDiscountPct?: number | null;
      taxPct?: number | null;
    };
    draft?: Record<
      string,
      {
        unitRate?: number | null;
        discountPct?: number | null;
        pricingStatus?: PricingStatus;
        remarks?: string | null;
      }
    >;
    extras?: Array<{
      description: string;
      unitRate?: number | null;
      quantity?: number | null;
      discountPct?: number | null;
      remarks?: string | null;
    }>;
  };

  const locale = detail.invite.preferredLocale;
  let lines = buildQuoteLinesFromPortalDraft(
    detail.invite.id,
    detail.specLines,
    body.draft ?? {},
    body.extras ?? [],
  );

  lines = lines.map((line) => {
    if (!line.specLineId) return line;
    const spec = detail.specLines.find((s) => s.id === line.specLineId);
    if (!spec) return line;
    return {
      ...line,
      description: resolveSpecDescription(spec.descriptions, locale),
    };
  });

  const calculated = await recalculateInviteLines(
    detail.project.id,
    detail.invite.id,
    lines,
  );

  await replaceQuoteLines(detail.invite.id, calculated, "yard");

  const metaInput = {
    inviteId: detail.invite.id,
    currency: body.meta?.currency ?? detail.project.currency,
    shipyardDays: detail.project.shipyardDays,
    dryDockDays: detail.project.dryDockDays,
    cprDays: detail.project.cprDays,
    exchangeRate: body.meta?.exchangeRate ?? detail.meta?.exchangeRate ?? null,
    validityDays: body.meta?.validityDays ?? detail.meta?.validityDays ?? null,
    generalNotes: body.meta?.generalNotes ?? detail.meta?.generalNotes ?? null,
    excelFileName: detail.meta?.excelFileName ?? null,
    globalDiscountPct: body.meta?.globalDiscountPct ?? detail.meta?.globalDiscountPct ?? null,
    taxPct: body.meta?.taxPct ?? detail.meta?.taxPct ?? null,
    quoteGrossTotal: null as number | null,
    quoteNetTotal: null as number | null,
  };

  const totals = recalculateQuoteMetaTotals(calculated, metaInput);
  await upsertQuoteMeta({ ...metaInput, ...totals }, "yard");

  const status = body.submit ? "submitted" : "in_progress";
  await updateInviteStatus(detail.invite.id, status, "portal", "yard");

  const updated = await getYardQuoteByToken(token);
  return NextResponse.json({ quote: updated, submitted: Boolean(body.submit) });
}
