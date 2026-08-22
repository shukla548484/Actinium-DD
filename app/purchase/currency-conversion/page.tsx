"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { notify } from "@/lib/notify";
import { COMMON_QUOTE_CURRENCIES, formatFxRate } from "@/lib/fx/rates";

type ProjectRow = {
  id: string;
  name: string;
  referenceCode: string | null;
  status: string;
  currency: string | null;
  projectId: string | null;
  vessel: { id: string; name: string; code: string };
  conversion: {
    id: string;
    localCurrency: string;
    localPerUsd: number;
    source: string;
    marketAvgLocalPerUsd: number | null;
    marketFetchedAt: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
};

const CURRENCY_ITEMS = COMMON_QUOTE_CURRENCIES.filter((c) => c.code !== "USD").map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.name}`,
}));

export default function PurchaseCurrencyConversionPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { localCurrency: string; localPerUsd: string; notes: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase/currency-conversion");
      const data = (await res.json()) as { projects?: ProjectRow[]; error?: string };
      if (!res.ok) {
        notify.error(data.error ?? "Failed to load projects");
        return;
      }
      const rows = data.projects ?? [];
      setProjects(rows);
      const next: typeof drafts = {};
      for (const p of rows) {
        next[p.id] = {
          localCurrency: p.conversion?.localCurrency ?? "KRW",
          localPerUsd: String(p.conversion?.localPerUsd ?? ""),
          notes: p.conversion?.notes ?? "",
        };
      }
      setDrafts(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(projectId: string, useMarket: boolean) {
    const draft = drafts[projectId];
    if (!draft) return;
    setSavingId(projectId);
    try {
      const res = await fetch("/api/purchase/currency-conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryDockProjectId: projectId,
          localCurrency: draft.localCurrency,
          localPerUsd: useMarket ? undefined : Number(draft.localPerUsd),
          useMarketAverage: useMarket,
          notes: draft.notes || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notify.error(data.error ?? "Save failed");
        return;
      }
      notify.success(useMarket ? "Saved 30-day market average rate" : "Saved project FX rate");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function previewMarket(projectId: string) {
    const draft = drafts[projectId];
    if (!draft) return;
    const res = await fetch(
      `/api/purchase/currency-conversion?previewCurrency=${encodeURIComponent(draft.localCurrency)}`,
    );
    const data = (await res.json()) as {
      market?: { localPerUsd: number; source: string };
      error?: string;
    };
    if (!res.ok || !data.market) {
      notify.error(data.error ?? "Market preview failed");
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId]!,
        localPerUsd: String(data.market!.localPerUsd),
      },
    }));
    notify.info(
      `Preview ${formatFxRate(data.market.localPerUsd, draft.localCurrency)} (${data.market.source})`,
    );
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Project currency conversion"
        description="Define local-currency units per 1 USD for each dry-dock project. Shipyard quotations use this rate; if unset, the app uses a 30-day internet average."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Enter how many units of the local currency equal 1 USD (e.g. KRW 1,320 = 1 USD).</p>
          <p>
            Use <strong>Apply 30-day average</strong> to pull ECB market data via Frankfurter and
            store it on the project.
          </p>
          <p>Shipyard quotes can be entered in USD or the project local currency, with dual display.</p>
        </CardContent>
      </Card>

      {loading ? (
        <ActiniumLoadingState label="Loading projects…" size="md" minHeight={140} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Local currency</TableHead>
                  <TableHead>Local / 1 USD</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No dry-dock projects found.
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((p) => {
                    const draft = drafts[p.id] ?? {
                      localCurrency: "KRW",
                      localPerUsd: "",
                      notes: "",
                    };
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {p.referenceCode ?? p.id.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.vessel.name} ({p.vessel.code})
                        </TableCell>
                        <TableCell className="min-w-[10rem]">
                          <LabeledSelect
                            items={CURRENCY_ITEMS}
                            value={draft.localCurrency}
                            onValueChange={(v) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, localCurrency: v },
                              }))
                            }
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell className="min-w-[8rem]">
                          <Input
                            type="number"
                            value={draft.localPerUsd}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [p.id]: { ...draft, localPerUsd: e.target.value },
                              }))
                            }
                            placeholder="e.g. 1320"
                          />
                          {p.conversion?.marketAvgLocalPerUsd != null ? (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Market ref: {p.conversion.marketAvgLocalPerUsd.toFixed(4)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.conversion?.source ?? "— (will use market)"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingId === p.id}
                              onClick={() => void previewMarket(p.id)}
                            >
                              Preview market
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingId === p.id}
                              onClick={() => void save(p.id, true)}
                            >
                              Apply 30-day avg
                            </Button>
                            <Button
                              size="sm"
                              disabled={savingId === p.id || !draft.localPerUsd}
                              onClick={() => void save(p.id, false)}
                            >
                              Save manual
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
