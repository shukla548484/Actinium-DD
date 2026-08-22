"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SHIPYARD_DOCK_CYCLE_LABELS } from "@/lib/shipyard/quotationCategories";

type OfficeRow = {
  id: string;
  referenceCode: string;
  status: string;
  dockCycle: string;
  dueAt: string | null;
  sentAt: string | null;
  submittedAt: string | null;
  jobCount: number;
  vessel: { id: string; name: string; code: string };
  yards: { id: string; name: string; code: string; inviteStatus: string }[];
  createdAt: string;
};

type DetailJob = {
  id: string;
  title: string;
  jobCode: string | null;
  quoteCategory: string;
  quoteLine: {
    quantity: number;
    unit: string;
    unitRate: number | null;
    amount: number | null;
    notes: string | null;
  } | null;
};

type DetailHeader = {
  referenceCode: string;
  status: string;
  dockCycle: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  dueAt: string | null;
  notes: string | null;
  vessel: { name: string; code: string; imoNumber: string | null };
  tariffSnapshot: {
    currency: string;
    ratesJson: unknown;
  } | null;
};

export default function SuperintendentQuotationsPage() {
  const [status, setStatus] = useState("submitted");
  const [rows, setRows] = useState<OfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailJobs, setDetailJobs] = useState<DetailJob[]>([]);
  const [detailTerms, setDetailTerms] = useState("");
  const [detailHeader, setDetailHeader] = useState<DetailHeader | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      const res = await fetch(`/api/superintendent/quotations?${params}`);
      const data = (await res.json()) as { rows?: OfficeRow[]; error?: string };
      if (!res.ok) {
        notify.error(data.error ?? "Failed to load quotations");
        setRows([]);
        return;
      }
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/superintendent/quotations?id=${id}`);
      const data = (await res.json()) as {
        error?: string;
        request?: DetailHeader & {
          jobs: DetailJob[];
          terms: { body: string } | null;
        };
      };
      if (!res.ok || !data.request) {
        notify.error(data.error ?? "Failed to load detail");
        return;
      }
      setDetailJobs(data.request.jobs);
      setDetailTerms(data.request.terms?.body ?? "");
      setDetailHeader({
        referenceCode: data.request.referenceCode,
        status: data.request.status,
        dockCycle: data.request.dockCycle,
        plannedStart: data.request.plannedStart,
        plannedEnd: data.request.plannedEnd,
        dueAt: data.request.dueAt,
        notes: data.request.notes,
        vessel: data.request.vessel,
        tariffSnapshot: data.request.tariffSnapshot,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Shipyard quotations"
        description="Review quotes submitted from vessel-job quotation requests (ship access → yard)."
      />

      <div className="mb-4 flex max-w-xs flex-col gap-1.5">
        <p className="text-sm font-medium">Status</p>
        <LabeledSelect
          items={[
            { value: "all", label: "All" },
            { value: "sent", label: "Sent" },
            { value: "in_progress", label: "In progress" },
            { value: "submitted", label: "Submitted" },
            { value: "withdrawn", label: "Withdrawn" },
          ]}
          value={status}
          onValueChange={setStatus}
          className="w-full"
        />
      </div>

      {loading ? (
        <ActiniumLoadingState label="Loading quotations…" size="md" minHeight={120} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Yard</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No quotation requests in this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.referenceCode}</TableCell>
                      <TableCell>
                        {row.vessel.name} ({row.vessel.code})
                      </TableCell>
                      <TableCell>
                        {row.yards.map((y) => y.name).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {SHIPYARD_DOCK_CYCLE_LABELS[
                          row.dockCycle as keyof typeof SHIPYARD_DOCK_CYCLE_LABELS
                        ] ?? row.dockCycle}
                      </TableCell>
                      <TableCell>{row.jobCount}</TableCell>
                      <TableCell>
                        {row.submittedAt
                          ? new Date(row.submittedAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(row.id)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedId ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quote detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <ActiniumLoadingState label="Loading…" size="sm" minHeight={80} />
            ) : (
              <>
                {detailHeader ? (
                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <p>
                      <span className="text-muted-foreground">Reference: </span>
                      <span className="font-mono">{detailHeader.referenceCode}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Vessel: </span>
                      {detailHeader.vessel.name} ({detailHeader.vessel.code})
                    </p>
                    <p>
                      <span className="text-muted-foreground">Status: </span>
                      {detailHeader.status}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Cycle: </span>
                      {SHIPYARD_DOCK_CYCLE_LABELS[
                        detailHeader.dockCycle as keyof typeof SHIPYARD_DOCK_CYCLE_LABELS
                      ] ?? detailHeader.dockCycle}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Window: </span>
                      {[detailHeader.plannedStart, detailHeader.plannedEnd]
                        .filter(Boolean)
                        .map((d) => new Date(d!).toLocaleDateString())
                        .join(" → ") || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Due: </span>
                      {detailHeader.dueAt
                        ? new Date(detailHeader.dueAt).toLocaleDateString()
                        : "—"}
                    </p>
                    {detailHeader.notes ? (
                      <p className="sm:col-span-2 lg:col-span-3">
                        <span className="text-muted-foreground">Notes: </span>
                        {detailHeader.notes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {detailJobs.map((job) => (
                    <div key={job.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[job.jobCode, job.quoteCategory].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs">
                        {job.quoteLine
                          ? `${job.quoteLine.quantity} ${job.quoteLine.unit} × ${job.quoteLine.unitRate ?? "—"} = ${job.quoteLine.amount ?? "—"}`
                          : "Unpriced"}
                      </div>
                    </div>
                  ))}
                </div>
                {detailTerms ? (
                  <div>
                    <p className="mb-1 text-sm font-medium">Terms</p>
                    <pre className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-xs">
                      {detailTerms}
                    </pre>
                  </div>
                ) : null}
                {Array.isArray(detailHeader?.tariffSnapshot?.ratesJson) &&
                (detailHeader.tariffSnapshot.ratesJson as unknown[]).length > 0 ? (
                  <div>
                    <p className="mb-1 text-sm font-medium">
                      Tariff snapshot ({detailHeader.tariffSnapshot.currency})
                    </p>
                    <div className="space-y-1 rounded border bg-muted/20 p-3 text-xs">
                      {(
                        detailHeader.tariffSnapshot.ratesJson as {
                          label: string;
                          unit: string;
                          unitRate: number;
                        }[]
                      ).map((r, i) => (
                        <div key={`${r.label}-${i}`} className="flex justify-between gap-2">
                          <span>
                            {r.label} ({r.unit})
                          </span>
                          <span className="font-mono">{r.unitRate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
