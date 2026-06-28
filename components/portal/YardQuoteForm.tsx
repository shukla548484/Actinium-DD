"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCALE_LABELS, type ScopeLocale } from "@/lib/i18n/scope";
import { categoryLabelFromList } from "@/lib/tender/categories";
import { portalUi } from "@/lib/i18n/portalUi";
import {
  lineMatchesWizardStep,
  WIZARD_STEPS,
  type WizardStep,
} from "@/lib/tender/catalogBuckets";
import { buildDurationContext, calculateLineTotal } from "@/lib/tender/calculate";
import { fmtMoney } from "@/lib/tender/format";
import { applyDiscount, applyQuoteCommercials, scopeSummary } from "@/lib/tender/resolveScope";
import type { PricingStatus, SpecLine, YardQuoteDetail } from "@/lib/tender/types";
import { YardQuoteLineTable } from "@/components/portal/YardQuoteLineTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCard } from "@/components/layout/TableCard";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type DraftLine = {
  unitRate: number | null;
  discountPct: number | null;
  pricingStatus: PricingStatus;
  remarks: string | null;
};

type ExtraLine = {
  description: string;
  unitRate: number | null;
  quantity: number | null;
  discountPct: number | null;
  remarks: string | null;
};

const STEP_ORDER: WizardStep[] = ["docking", "general", "other", "summary"];

interface Props {
  token: string;
}

export function YardQuoteForm({ token }: Props) {
  const [quote, setQuote] = useState<YardQuoteDetail | null>(null);
  const [locale, setLocale] = useState<ScopeLocale>("en");
  const [step, setStep] = useState<WizardStep>("docking");
  const [draft, setDraft] = useState<Record<string, DraftLine>>({});
  const [extras, setExtras] = useState<ExtraLine[]>([]);
  const [meta, setMeta] = useState({
    currency: "USD",
    validityDays: null as number | null,
    generalNotes: null as string | null,
    globalDiscountPct: null as number | null,
    taxPct: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/quote/${token}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Quote not found.");
      return;
    }
    const q = data.quote as YardQuoteDetail;
    setQuote(q);
    setLocale(q.invite.preferredLocale);

    const nextDraft: Record<string, DraftLine> = {};
    for (const spec of q.specLines) {
      const existing = q.lines.find((l) => l.specLineId === spec.id && !l.isExtra);
      nextDraft[spec.id] = {
        unitRate: existing?.unitRate ?? null,
        discountPct: existing?.discountPct ?? 0,
        pricingStatus: existing?.pricingStatus ?? "priced",
        remarks: existing?.remarks ?? null,
      };
    }
    setDraft(nextDraft);
    setExtras(
      q.lines
        .filter((l) => l.isExtra)
        .map((l) => ({
          description: l.description,
          unitRate: l.unitRate,
          quantity: l.quantity,
          discountPct: l.discountPct ?? 0,
          remarks: l.remarks,
        })),
    );
    setMeta({
      currency: q.meta?.currency ?? q.project.currency,
      validityDays: q.meta?.validityDays ?? null,
      generalNotes: q.meta?.generalNotes ?? null,
      globalDiscountPct: q.meta?.globalDiscountPct ?? null,
      taxPct: q.meta?.taxPct ?? null,
    });
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = useCallback((key: Parameters<typeof portalUi>[1]) => portalUi(locale, key), [locale]);

  const duration = useMemo(() => {
    if (!quote) return null;
    return buildDurationContext(quote.project, {
      inviteId: quote.invite.id,
      currency: meta.currency,
      shipyardDays: quote.project.shipyardDays,
      dryDockDays: quote.project.dryDockDays,
      cprDays: quote.project.cprDays,
      exchangeRate: null,
      validityDays: meta.validityDays,
      generalNotes: meta.generalNotes,
      excelFileName: null,
      globalDiscountPct: meta.globalDiscountPct,
      taxPct: meta.taxPct,
      quoteGrossTotal: null,
      quoteNetTotal: null,
    });
  }, [quote, meta]);

  const linePreview = useCallback(
    (spec: SpecLine, d: DraftLine) => {
      if (!duration) return { gross: null as number | null, net: null as number | null };
      const qty = scopeSummary(spec, duration).quantity;
      const gross = calculateLineTotal(
        spec,
        {
          unitRate: d.unitRate,
          quantity: qty,
          quotedTotal: null,
          pricingStatus: d.pricingStatus,
        },
        duration,
      );
      const { netTotal } = applyDiscount(
        gross,
        spec.allowDiscount ? d.discountPct : 0,
        spec.maxDiscountPct,
      );
      return { gross, net: netTotal };
    },
    [duration],
  );

  const quotePreview = useMemo(() => {
    if (!quote || !duration) return { grossTotal: null as number | null, netTotal: null as number | null };
    let lineNetSum = 0;
    for (const spec of quote.specLines) {
      const d = draft[spec.id];
      if (!d || d.pricingStatus !== "priced") continue;
      const { net } = linePreview(spec, d);
      if (net != null) lineNetSum += net;
    }
    for (const ex of extras) {
      if (!ex.description.trim() || ex.unitRate == null) continue;
      const gross = ex.quantity != null ? ex.unitRate * ex.quantity : ex.unitRate;
      const { netTotal } = applyDiscount(gross, ex.discountPct);
      if (netTotal != null) lineNetSum += netTotal;
    }
    return applyQuoteCommercials(lineNetSum, meta.globalDiscountPct, meta.taxPct);
  }, [quote, duration, draft, extras, meta.globalDiscountPct, meta.taxPct, linePreview]);

  const tableLabels = useMemo(
    () => ({
      lineCode: t("lineCode"),
      description: t("description"),
      scopeNotes: t("scopeNotes"),
      unit: t("unit"),
      scopeQty: t("scopeQty"),
      scopeDays: t("scopeDays"),
      scopeArea: t("scopeArea"),
      referenceRate: t("referenceRate"),
      unitRate: t("unitRate"),
      discountPct: t("discountPct"),
      gross: t("gross"),
      net: t("net"),
      status: t("status"),
      remarks: t("remarks"),
      optional: t("optional"),
      priced: t("priced"),
      included: t("included"),
      na: t("na"),
      ownerSupply: t("ownerSupply"),
    }),
    [t],
  );

  const linesForStep = useMemo(() => {
    if (!quote || step === "summary") return [];
    return quote.specLines.filter((s) => lineMatchesWizardStep(s.bucket, step));
  }, [quote, step]);

  const groupedOther = useMemo(() => {
    if (!quote || step !== "other") return [];
    const buckets = new Map<string, SpecLine[]>();
    for (const spec of linesForStep) {
      const list = buckets.get(spec.bucket) ?? [];
      list.push(spec);
      buckets.set(spec.bucket, list);
    }
    return [...buckets.entries()];
  }, [quote, step, linesForStep]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const templateHref = useMemo(() => {
    if (step === "docking") return `/api/quote/${token}/template?step=docking`;
    if (step === "general") return `/api/quote/${token}/template?step=general`;
    return `/api/quote/${token}/template`;
  }, [step, token]);

  async function save(submit: boolean) {
    if (!quote) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/quote/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submit, meta, draft, extras }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "Save failed.");
      return;
    }

    setQuote(data.quote);
    setMessage(submit ? t("submitted") : "Progress saved.");
    if (submit) void load();
  }

  function goNext() {
    if (stepIndex < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[stepIndex + 1]!);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStep(STEP_ORDER[stepIndex - 1]!);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-muted-foreground">Loading quotation portal…</p>;
  }

  if (!quote) {
    return (
      <p className="p-8 text-center text-destructive">{message ?? "Invalid quote link."}</p>
    );
  }

  const currency = meta.currency ?? quote.project.currency;
  const stepTitle =
    step === "docking"
      ? t("stepDocking")
      : step === "general"
        ? t("stepGeneral")
        : step === "other"
          ? t("stepOther")
          : t("stepSummary");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("portalTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("project")}: {quote.project.name}
            {quote.project.vesselName ? ` · ${t("vessel")}: ${quote.project.vesselName}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">{quote.invite.yardName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<a href={templateHref} />}
            nativeButton={false}
          >
            {t("downloadTemplate")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("alsoShownIn")}:</span>
          <ToggleGroup
            value={[locale]}
            onValueChange={(values) => {
              const next = values[values.length - 1] as ScopeLocale | undefined;
              if (next) setLocale(next);
            }}
            spacing={0}
            variant="outline"
            size="sm"
          >
            {(["en", "zh", "ja"] as ScopeLocale[]).map((l) => (
              <ToggleGroupItem key={l} value={l} className="text-xs">
                {LOCALE_LABELS[l]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      <nav aria-label={t("wizardProgress")} className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s, i) => {
          const label =
            s.id === "docking"
              ? t("stepDocking")
              : s.id === "general"
                ? t("stepGeneral")
                : s.id === "other"
                  ? t("stepOther")
                  : t("stepSummary");
          const active = step === s.id;
          const done = i < stepIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {i + 1}. {label}
            </button>
          );
        })}
      </nav>

      <Alert className="border-blue-200 bg-blue-50 text-blue-900">
        <AlertDescription>{t("yardHint")}</AlertDescription>
      </Alert>

      {message && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-muted/50">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField label={t("shipyardDays")} value={quote.project.shipyardDays} />
          <ReadOnlyField label={t("dryDockDays")} value={quote.project.dryDockDays} />
          <ReadOnlyField label={t("cprDays")} value={quote.project.cprDays} />
          <ReadOnlyField label={t("currency")} value={currency} />
          {step === "summary" && (
            <>
              <Field label={t("validity")}>
                <Input
                  type="number"
                  value={meta.validityDays ?? ""}
                  onChange={(e) =>
                    setMeta({ ...meta, validityDays: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label={t("globalDiscount")}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={meta.globalDiscountPct ?? ""}
                  onChange={(e) =>
                    setMeta({
                      ...meta,
                      globalDiscountPct: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label={t("taxPct")}>
                <Input
                  type="number"
                  min={0}
                  value={meta.taxPct ?? ""}
                  onChange={(e) =>
                    setMeta({ ...meta, taxPct: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label={t("generalNotes")} className="sm:col-span-2 lg:col-span-4">
                <Textarea
                  value={meta.generalNotes ?? ""}
                  onChange={(e) => setMeta({ ...meta, generalNotes: e.target.value || null })}
                  rows={2}
                />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      {step !== "summary" && (
        <TableCard title={`${stepTitle} — ${t("ownerScope")}`}>
          {step === "other" ? (
            groupedOther.length === 0 ? (
              <YardQuoteLineTable
                lines={[]}
                draft={draft}
                locale={locale}
                currency={currency}
                duration={duration}
                labels={tableLabels}
                onDraftChange={setDraft}
                linePreview={linePreview}
              />
            ) : (
              groupedOther.map(([bucket, lines]) => (
                <div key={bucket} className="mb-6 last:mb-0">
                  <h4 className="mb-2 text-sm font-semibold">
                    {categoryLabelFromList(quote.categories, bucket)}
                  </h4>
                  <YardQuoteLineTable
                    lines={lines}
                    draft={draft}
                    locale={locale}
                    currency={currency}
                    duration={duration}
                    labels={tableLabels}
                    onDraftChange={setDraft}
                    linePreview={linePreview}
                  />
                </div>
              ))
            )
          ) : (
            <YardQuoteLineTable
              lines={linesForStep}
              draft={draft}
              locale={locale}
              currency={currency}
              duration={duration}
              labels={tableLabels}
              onDraftChange={setDraft}
              linePreview={linePreview}
            />
          )}
        </TableCard>
      )}

      {step === "general" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">{t("extraLines")}</CardTitle>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() =>
                setExtras([
                  ...extras,
                  {
                    description: "",
                    unitRate: null,
                    quantity: null,
                    discountPct: 0,
                    remarks: null,
                  },
                ])
              }
            >
              + {t("addExtraLine")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {extras.map((ex, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-6">
                <Input
                  placeholder={t("description")}
                  value={ex.description}
                  onChange={(e) => {
                    const next = [...extras];
                    next[i] = { ...ex, description: e.target.value };
                    setExtras(next);
                  }}
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  placeholder={t("qty")}
                  value={ex.quantity ?? ""}
                  onChange={(e) => {
                    const next = [...extras];
                    next[i] = { ...ex, quantity: e.target.value ? Number(e.target.value) : null };
                    setExtras(next);
                  }}
                />
                <Input
                  type="number"
                  placeholder={t("unitRate")}
                  value={ex.unitRate ?? ""}
                  onChange={(e) => {
                    const next = [...extras];
                    next[i] = { ...ex, unitRate: e.target.value ? Number(e.target.value) : null };
                    setExtras(next);
                  }}
                />
                <Input
                  type="number"
                  placeholder={t("discountPct")}
                  value={ex.discountPct ?? ""}
                  onChange={(e) => {
                    const next = [...extras];
                    next[i] = { ...ex, discountPct: e.target.value ? Number(e.target.value) : 0 };
                    setExtras(next);
                  }}
                />
                <Input
                  placeholder={t("remarks")}
                  value={ex.remarks ?? ""}
                  onChange={(e) => {
                    const next = [...extras];
                    next[i] = { ...ex, remarks: e.target.value || null };
                    setExtras(next);
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === "summary" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("stepSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("quoteGross")}</p>
                <p className="text-lg font-semibold">{fmtMoney(quotePreview.grossTotal, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("quoteNet")}</p>
                <p className="text-lg font-bold">{fmtMoney(quotePreview.netTotal, currency)}</p>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {WIZARD_STEPS.filter((s) => s.id !== "summary").map((s) => {
                const count = quote.specLines.filter((line) =>
                  lineMatchesWizardStep(line.bucket, s.id),
                ).length;
                const label =
                  s.id === "docking"
                    ? t("stepDocking")
                    : s.id === "general"
                      ? t("stepGeneral")
                      : t("stepOther");
                return (
                  <li key={s.id}>
                    {label}: {count} line{count !== 1 ? "s" : ""}
                    {s.id === "general" && extras.length > 0
                      ? ` · ${extras.length} extra item(s)`
                      : ""}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {step !== "summary" && (
        <Card>
          <CardContent className="flex flex-wrap gap-6 pt-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("quoteGross")}</p>
              <p className="text-lg font-semibold">{fmtMoney(quotePreview.grossTotal, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("quoteNet")}</p>
              <p className="text-lg font-bold">{fmtMoney(quotePreview.netTotal, currency)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <footer className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={stepIndex === 0} onClick={goBack}>
          {t("back")}
        </Button>
        {step !== "summary" ? (
          <Button type="button" onClick={goNext}>
            {t("next")}
          </Button>
        ) : (
          <Button type="button" disabled={saving} onClick={() => void save(true)}>
            {saving ? "…" : t("submitQuote")}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() => void save(false)}
        >
          {saving ? "…" : t("saveDraft")}
        </Button>
      </footer>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="space-y-2 text-xs">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="rounded-lg border bg-card px-2.5 py-1.5 text-sm">{value ?? "—"}</div>
    </div>
  );
}
