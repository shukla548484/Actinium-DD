"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { ShipyardQuotationLanguageBar } from "@/components/shipyard/ShipyardQuotationLanguageBar";
import { useShipyardLanguage } from "@/components/shipyard/ShipyardLanguageProvider";
import { notify } from "@/lib/notify";
import {
  SHIPYARD_DOCK_CYCLE_LABELS,
  SHIPYARD_QUOTE_JOB_CATEGORY_ORDER,
} from "@/lib/shipyard/quotationCategories";
import { SHIPYARD_TARIFF_GROUP_LABELS } from "@/lib/shipyard/tariffDefaults";
import {
  shipyardQuoteUi,
  type ShipyardQuoteLocale,
  type ShipyardQuoteUiKey,
} from "@/lib/i18n/shipyardQuotationUi";
import { formatFxRate } from "@/lib/fx/rates";
import { mapSelectItems } from "@/lib/ui/labeledSelect";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type QuoteLine = {
  quantity: number;
  unit: string;
  unitRate: number | null;
  amount: number | null;
  unitRateUsd: number | null;
  amountUsd: number | null;
  notes: string | null;
};

type RequestJob = {
  id: string;
  quoteCategory: (typeof SHIPYARD_QUOTE_JOB_CATEGORY_ORDER)[number];
  jobCode: string | null;
  title: string;
  category: string;
  workshop: string | null;
  description: string | null;
  priority: string;
  quoteLine: QuoteLine | null;
};

type TariffRate = {
  id: string;
  groupKey: keyof typeof SHIPYARD_TARIFF_GROUP_LABELS;
  label: string;
  unit: string;
  unitRate: number;
  notes: string | null;
  sortOrder: number;
};

type TariffSchedule = {
  id: string;
  name: string;
  currency: string;
  isDefault: boolean;
  rates: TariffRate[];
};

type QuotationDetail = {
  id: string;
  referenceCode: string;
  status: string;
  dockCycle: keyof typeof SHIPYARD_DOCK_CYCLE_LABELS;
  plannedStart: string | null;
  plannedEnd: string | null;
  dryDockDays: number | null;
  shipyardDays: number | null;
  cprDays: number | null;
  dueAt: string | null;
  notes: string | null;
  currency: string;
  localCurrency: string | null;
  quoteCurrency: string;
  exchangeRateLocalPerUsd: number | null;
  exchangeRateSource: string | null;
  dryDockProjectId: string | null;
  vessel: {
    name: string;
    code: string;
    imoNumber: string | null;
    flag: string | null;
    vesselType: string | null;
    callSign: string | null;
    grossTonnage: number | null;
    yearBuilt: number | null;
    classSociety: string | null;
    nextDryDockDue: string | null;
    lastDryDockDate: string | null;
  };
  dryDockProject: {
    id: string;
    name: string;
    referenceCode: string;
    plannedStart: string | null;
    plannedEnd: string | null;
    dryDockDays: number | null;
    portLocation: string | null;
    milestones: { id: string; title: string; plannedDate: string | null; status: string }[];
  } | null;
  jobs: RequestJob[];
  terms: { body: string } | null;
  tariffSnapshot: {
    currency: string;
    ratesJson: unknown;
  } | null;
  invites: { id: string; token?: string; status: string }[];
};

type LineDraft = {
  quantity: string;
  unit: string;
  unitRate: string;
  notes: string;
};

type Props = {
  mode: "session" | "token";
  requestId?: string;
  token?: string;
};

const CAT_KEY: Record<(typeof SHIPYARD_QUOTE_JOB_CATEGORY_ORDER)[number], ShipyardQuoteUiKey> = {
  deck: "catDeck",
  machinery: "catMachinery",
  hull_walls_overboard: "catHull",
  painting: "catPainting",
  other: "catOther",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function QuotationWorkspace({ mode, requestId, token }: Props) {
  const shellLang = useShipyardLanguage();
  const [tokenLocale, setTokenLocale] = useState<ShipyardQuoteLocale>("en");
  const locale = mode === "token" ? tokenLocale : shellLang.locale;
  const dual = mode === "token" ? tokenLocale !== "en" : shellLang.prefs.mode === "dual";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [tariffs, setTariffs] = useState<TariffSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [termsBody, setTermsBody] = useState("");
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [inviteId, setInviteId] = useState<string | null>(null);

  const t = useCallback((key: ShipyardQuoteUiKey) => shipyardQuoteUi(locale, key), [locale]);
  const label = useCallback(
    (key: ShipyardQuoteUiKey) => {
      if (mode !== "token") return shellLang.label(key);
      const primary = shipyardQuoteUi(locale, key);
      if (!dual) return primary;
      const english = shipyardQuoteUi("en", key);
      if (english === primary) return primary;
      return (
        <span className="inline-flex flex-col leading-tight">
          <span>{primary}</span>
          <span className="text-[10px] font-normal text-muted-foreground">{english}</span>
        </span>
      );
    },
    [dual, locale, mode, shellLang],
  );

  const apiBase =
    mode === "token"
      ? `/api/shipyard/quotations/by-token/${token}`
      : `/api/shipyard/quotations/${requestId}`;

  const locked = detail?.status === "submitted" || detail?.status === "withdrawn";

  const hydrate = useCallback((req: QuotationDetail) => {
    setDetail(req);
    setTermsBody(req.terms?.body ?? "");
    const drafts: Record<string, LineDraft> = {};
    for (const job of req.jobs) {
      drafts[job.id] = {
        quantity: String(job.quoteLine?.quantity ?? 1),
        unit: job.quoteLine?.unit ?? "ls",
        unitRate: job.quoteLine?.unitRate == null ? "" : String(job.quoteLine.unitRate),
        notes: job.quoteLine?.notes ?? "",
      };
    }
    setLineDrafts(drafts);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = (await res.json()) as {
        error?: string;
        request?: QuotationDetail;
        tariffs?: TariffSchedule[];
        inviteId?: string | null;
      };
      if (!res.ok || !data.request) {
        notify.error(data.error ?? "Failed to load quotation");
        setDetail(null);
        return;
      }
      hydrate(data.request);
      setTariffs(data.tariffs ?? []);
      const def = data.tariffs?.find((x) => x.isDefault) ?? data.tariffs?.[0];
      setScheduleId(def?.id ?? "");
      if (def) {
        const rates: Record<string, string> = {};
        for (const r of def.rates) rates[r.id] = String(r.unitRate);
        setRateDrafts(rates);
      }
      setInviteId(data.inviteId ?? data.request.invites[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const jobs = detail?.jobs ?? [];
    const map: Record<string, RequestJob[]> = {};
    for (const cat of SHIPYARD_QUOTE_JOB_CATEGORY_ORDER) map[cat] = [];
    for (const job of jobs) {
      (map[job.quoteCategory] ?? map.other).push(job);
    }
    return map;
  }, [detail?.jobs]);

  const scheduleItems = mapSelectItems(
    tariffs,
    (x) => x.id,
    (x) => `${x.name}${x.isDefault ? " (default)" : ""}`,
  );

  const activeSchedule = tariffs.find((x) => x.id === scheduleId) ?? null;

  async function persistLines(): Promise<boolean> {
    if (!detail || locked) return true;
    const lines = Object.entries(lineDrafts).map(([requestJobId, d]) => ({
      requestJobId,
      quantity: Number(d.quantity) || 1,
      unit: d.unit || "ls",
      unitRate: d.unitRate.trim() === "" ? null : Number(d.unitRate),
      notes: d.notes || null,
    }));
    const res = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_lines", lines }),
    });
    const data = (await res.json()) as { error?: string; request?: QuotationDetail };
    if (!res.ok || !data.request) {
      notify.error(data.error ?? t("saveFailed"));
      return false;
    }
    hydrate(data.request);
    return true;
  }

  async function persistTerms(): Promise<boolean> {
    if (!detail || locked) return true;
    const res = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_terms", body: termsBody }),
    });
    const data = (await res.json()) as { error?: string; request?: QuotationDetail };
    if (!res.ok || !data.request) {
      notify.error(data.error ?? t("saveFailed"));
      return false;
    }
    hydrate(data.request);
    return true;
  }

  async function saveDraft() {
    if (!detail || locked) return;
    setSaving(true);
    try {
      const okLines = await persistLines();
      if (!okLines) return;
      const okTerms = await persistTerms();
      if (!okTerms) return;
      notify.success(t("savedDraft"));
    } finally {
      setSaving(false);
    }
  }

  async function saveLinesOnly() {
    if (!detail || locked) return;
    setSaving(true);
    try {
      if (await persistLines()) notify.success(t("savedLines"));
    } finally {
      setSaving(false);
    }
  }

  async function saveTermsOnly() {
    if (!detail || locked) return;
    setSaving(true);
    try {
      if (await persistTerms()) notify.success(t("savedTerms"));
    } finally {
      setSaving(false);
    }
  }

  async function applyTariff() {
    if (!detail || locked || !scheduleId) return;
    setSaving(true);
    try {
      if (mode === "session") {
        const ratePayload = Object.entries(rateDrafts).map(([id, unitRate]) => ({
          id,
          unitRate: Number(unitRate) || 0,
        }));
        await fetch("/api/shipyard/tariffs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId, rates: ratePayload }),
        });
      }
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_tariff", scheduleId }),
      });
      const data = (await res.json()) as { error?: string; request?: QuotationDetail };
      if (!res.ok || !data.request) {
        notify.error(data.error ?? t("saveFailed"));
        return;
      }
      hydrate(data.request);
      notify.success(t("tariffApplied"));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function copyTariff() {
    if (!scheduleId || mode !== "session") return;
    setSaving(true);
    try {
      const res = await fetch("/api/shipyard/tariffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", scheduleId }),
      });
      const data = (await res.json()) as {
        error?: string;
        schedule?: TariffSchedule;
        schedules?: TariffSchedule[];
      };
      if (!res.ok || !data.schedule) {
        notify.error(data.error ?? t("saveFailed"));
        return;
      }
      setTariffs(data.schedules ?? [...tariffs, data.schedule]);
      setScheduleId(data.schedule.id);
      const rates: Record<string, string> = {};
      for (const r of data.schedule.rates) rates[r.id] = String(r.unitRate);
      setRateDrafts(rates);
      notify.success(t("tariffCopied"));
    } finally {
      setSaving(false);
    }
  }

  async function submitQuote() {
    if (!detail || locked) return;
    setSaving(true);
    try {
      const okLines = await persistLines();
      if (!okLines) return;
      const okTerms = await persistTerms();
      if (!okTerms) return;
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...(inviteId ? { inviteId } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        request?: QuotationDetail;
        message?: string;
      };
      if (!res.ok || !data.request) {
        notify.error(data.error ?? t("submitFailed"));
        return;
      }
      hydrate(data.request);
      notify.success(data.message ?? t("submitted"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ActiniumLoadingState label={t("loading")} size="md" minHeight={180} />;
  }

  if (!detail) {
    return <p className="text-sm text-destructive">{t("notFound")}</p>;
  }

  const snapshotRates = Array.isArray(detail.tariffSnapshot?.ratesJson)
    ? (detail.tariffSnapshot!.ratesJson as {
        groupKey: string;
        label: string;
        unit: string;
        unitRate: number;
        notes?: string | null;
      }[])
    : [];

  return (
    <div className="space-y-4">
      {mode === "token" ? (
        <ShipyardQuotationLanguageBar
          onChange={(_prefs, active) => setTokenLocale(active)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{detail.referenceCode}</p>
          <h2 className="text-lg font-semibold">
            {detail.vessel.name}{" "}
            <span className="text-muted-foreground">({detail.vessel.code})</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {detail.exchangeRateLocalPerUsd
              ? formatFxRate(
                  detail.exchangeRateLocalPerUsd,
                  detail.localCurrency ?? "KRW",
                )
              : null}
            {detail.exchangeRateSource ? ` · ${detail.exchangeRateSource}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{detail.status}</Badge>
          {!locked ? (
            <div className="flex items-center gap-2 rounded-md border px-2 py-1">
              <span className="text-xs text-muted-foreground">Quote in</span>
              <ToggleGroup
                value={[detail.quoteCurrency || "USD"]}
                onValueChange={(values) => {
                  const next = values[values.length - 1];
                  if (!next || locked) return;
                  void (async () => {
                    setSaving(true);
                    try {
                      const res = await fetch(apiBase, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "set_currency",
                          quoteCurrency: next,
                          localCurrency: detail.localCurrency ?? "KRW",
                        }),
                      });
                      const data = (await res.json()) as {
                        error?: string;
                        request?: QuotationDetail;
                      };
                      if (!res.ok || !data.request) {
                        notify.error(data.error ?? t("saveFailed"));
                        return;
                      }
                      hydrate(data.request);
                    } finally {
                      setSaving(false);
                    }
                  })();
                }}
                spacing={0}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="USD" className="text-xs">
                  USD
                </ToggleGroupItem>
                <ToggleGroupItem
                  value={(detail.localCurrency || "KRW").toUpperCase()}
                  className="text-xs"
                >
                  {(detail.localCurrency || "KRW").toUpperCase()}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : (
            <Badge variant="outline">Quoted in {detail.quoteCurrency || detail.currency}</Badge>
          )}
          {!locked ? (
            <>
              <Button variant="outline" disabled={saving} onClick={() => void saveDraft()}>
                {label("saveDraft")}
              </Button>
              <Button disabled={saving} onClick={() => void submitQuote()}>
                {label("submitQuote")}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("quoteLocked")}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="vessel">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="vessel">{label("tabVessel")}</TabsTrigger>
          <TabsTrigger value="timeline">{label("tabTimeline")}</TabsTrigger>
          <TabsTrigger value="jobs">{label("tabJobs")}</TabsTrigger>
          <TabsTrigger value="terms">{label("tabTerms")}</TabsTrigger>
          <TabsTrigger value="tariff">{label("tabTariff")}</TabsTrigger>
        </TabsList>

        <TabsContent value="vessel" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{label("vesselParticulars")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label={label("name")} value={detail.vessel.name} />
              <Field label={label("code")} value={detail.vessel.code} />
              <Field label={label("imo")} value={detail.vessel.imoNumber} />
              <Field label={label("type")} value={detail.vessel.vesselType} />
              <Field label={label("flag")} value={detail.vessel.flag} />
              <Field label={label("callSign")} value={detail.vessel.callSign} />
              <Field
                label={label("grossTonnage")}
                value={detail.vessel.grossTonnage != null ? String(detail.vessel.grossTonnage) : null}
              />
              <Field
                label={label("yearBuilt")}
                value={detail.vessel.yearBuilt != null ? String(detail.vessel.yearBuilt) : null}
              />
              <Field label={label("classSociety")} value={detail.vessel.classSociety} />
              <Field label={label("lastDryDock")} value={fmtDate(detail.vessel.lastDryDockDate)} />
              <Field label={label("nextDryDockDue")} value={fmtDate(detail.vessel.nextDryDockDue)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{label("dryDockWindow")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label={label("dockCycle")}
                value={SHIPYARD_DOCK_CYCLE_LABELS[detail.dockCycle] ?? detail.dockCycle}
              />
              <Field label={label("plannedStart")} value={fmtDate(detail.plannedStart)} />
              <Field label={label("plannedEnd")} value={fmtDate(detail.plannedEnd)} />
              <Field
                label={label("dryDockDays")}
                value={detail.dryDockDays != null ? String(detail.dryDockDays) : null}
              />
              <Field
                label={label("shipyardDays")}
                value={detail.shipyardDays != null ? String(detail.shipyardDays) : null}
              />
              <Field
                label={label("cprDays")}
                value={detail.cprDays != null ? String(detail.cprDays) : null}
              />
              <Field label={label("quoteDue")} value={fmtDate(detail.dueAt)} />
              <Field label={label("notes")} value={detail.notes} />
            </CardContent>
          </Card>
          {detail.dryDockProject ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("project")} {detail.dryDockProject.referenceCode} —{" "}
                  {detail.dryDockProject.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={label("port")} value={detail.dryDockProject.portLocation} />
                  <Field
                    label={label("start")}
                    value={fmtDate(detail.dryDockProject.plannedStart)}
                  />
                  <Field label={label("end")} value={fmtDate(detail.dryDockProject.plannedEnd)} />
                </div>
                {detail.dryDockProject.milestones.length > 0 ? (
                  <ul className="space-y-1 border-t pt-3">
                    {detail.dryDockProject.milestones.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <span>{m.title}</span>
                        <span className="text-muted-foreground">
                          {fmtDate(m.plannedDate)} · {m.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t("noMilestones")}</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4 space-y-4">
          {SHIPYARD_QUOTE_JOB_CATEGORY_ORDER.map((cat) => {
            const jobs = grouped[cat] ?? [];
            if (jobs.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle>{label(CAT_KEY[cat])}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobs.map((job) => {
                    const draft = lineDrafts[job.id];
                    return (
                      <div key={job.id} className="space-y-2 rounded-md border p-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <p className="font-medium">{job.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {[job.jobCode, job.category, job.workshop, job.priority]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {detail.quoteCurrency || detail.currency}
                            {job.quoteLine?.unitRateUsd != null &&
                            (detail.quoteCurrency || "USD") !== "USD"
                              ? ` · ≈ ${job.quoteLine.unitRateUsd.toFixed(2)} USD`
                              : job.quoteLine?.amount != null &&
                                  (detail.quoteCurrency || "USD") === "USD" &&
                                  detail.localCurrency &&
                                  detail.exchangeRateLocalPerUsd
                                ? ` · ≈ ${(job.quoteLine.amount * detail.exchangeRateLocalPerUsd).toFixed(0)} ${detail.localCurrency}`
                                : ""}
                          </p>
                        </div>
                        {job.description ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {job.description}
                          </p>
                        ) : null}
                        <div className="grid gap-2 sm:grid-cols-4">
                          <div>
                            <p className="mb-1 text-xs font-medium">{label("qty")}</p>
                            <Input
                              disabled={locked}
                              value={draft?.quantity ?? "1"}
                              onChange={(e) =>
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [job.id]: { ...prev[job.id]!, quantity: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium">{label("unit")}</p>
                            <Input
                              disabled={locked}
                              value={draft?.unit ?? "ls"}
                              onChange={(e) =>
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [job.id]: { ...prev[job.id]!, unit: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium">{label("unitRate")}</p>
                            <Input
                              type="number"
                              disabled={locked}
                              value={draft?.unitRate ?? ""}
                              onChange={(e) =>
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [job.id]: { ...prev[job.id]!, unitRate: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium">{label("lineNotes")}</p>
                            <Input
                              disabled={locked}
                              value={draft?.notes ?? ""}
                              onChange={(e) =>
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [job.id]: { ...prev[job.id]!, notes: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
          {!locked ? (
            <Button disabled={saving} onClick={() => void saveLinesOnly()}>
              {label("saveJobQuotes")}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="terms" className="mt-4 space-y-3">
          <Textarea
            rows={16}
            disabled={locked}
            value={termsBody}
            onChange={(e) => setTermsBody(e.target.value)}
            placeholder={t("pasteTerms")}
          />
          {!locked ? (
            <Button disabled={saving} onClick={() => void saveTermsOnly()}>
              {label("saveTerms")}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="tariff" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{label("tariffSchedule")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md space-y-2">
                <p className="text-sm font-medium">{label("schedule")}</p>
                <LabeledSelect
                  items={
                    scheduleItems.length
                      ? scheduleItems
                      : [{ value: "", label: t("noSchedules") }]
                  }
                  value={scheduleId}
                  onValueChange={(id) => {
                    setScheduleId(id);
                    const s = tariffs.find((x) => x.id === id);
                    if (s) {
                      const rates: Record<string, string> = {};
                      for (const r of s.rates) rates[r.id] = String(r.unitRate);
                      setRateDrafts(rates);
                    }
                  }}
                  disabled={locked || tariffs.length === 0}
                  className="w-full"
                />
              </div>

              {activeSchedule ? (
                <div className="space-y-3">
                  {Object.entries(
                    activeSchedule.rates.reduce<Record<string, TariffRate[]>>((acc, rate) => {
                      (acc[rate.groupKey] ??= []).push(rate);
                      return acc;
                    }, {}),
                  ).map(([group, rates]) => (
                    <div key={group} className="space-y-2">
                      <p className="text-sm font-semibold">
                        {SHIPYARD_TARIFF_GROUP_LABELS[
                          group as keyof typeof SHIPYARD_TARIFF_GROUP_LABELS
                        ] ?? group}
                      </p>
                      {rates.map((rate) => (
                        <div
                          key={rate.id}
                          className="grid gap-2 rounded border p-2 sm:grid-cols-[1fr_80px_120px]"
                        >
                          <div>
                            <p className="text-sm">{rate.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("unit")}: {rate.unit}
                            </p>
                          </div>
                          <Input
                            type="number"
                            disabled={locked || mode === "token"}
                            value={rateDrafts[rate.id] ?? String(rate.unitRate)}
                            onChange={(e) =>
                              setRateDrafts((prev) => ({ ...prev, [rate.id]: e.target.value }))
                            }
                          />
                          <p className="self-center text-xs text-muted-foreground">
                            {activeSchedule.currency} / {rate.unit}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {!locked ? (
                <div className="flex flex-wrap gap-2">
                  {mode === "session" ? (
                    <Button
                      variant="outline"
                      disabled={saving || !scheduleId}
                      onClick={() => void copyTariff()}
                    >
                      {label("copySchedule")}
                    </Button>
                  ) : null}
                  <Button disabled={saving || !scheduleId} onClick={() => void applyTariff()}>
                    {label(mode === "session" ? "saveRatesSnapshot" : "snapshotTariff")}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {snapshotRates.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{label("quoteTariffSnapshot")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {snapshotRates.map((r, idx) => (
                  <div
                    key={`${r.label}-${idx}`}
                    className="flex justify-between gap-2 border-b py-1"
                  >
                    <span>
                      {r.label}{" "}
                      <span className="text-muted-foreground">({r.unit})</span>
                    </span>
                    <span className="font-mono">
                      {r.unitRate} {detail.tariffSnapshot?.currency}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: ReactNode;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
