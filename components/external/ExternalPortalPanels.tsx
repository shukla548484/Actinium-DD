"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QuoteRow = {
  inviteId: string;
  projectName: string;
  yardName: string | null;
  status: string;
  quoteTotal: number | null;
  currency: string | null;
  token: string;
};

type OversightRow = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  vesselName: string;
  plannedStart: string | null;
};

type ServiceRow = {
  id: string;
  jobCode: string | null;
  jobTitle: string;
  workshopSlug: string;
  status: string;
  progressPct: number;
  projectName: string;
};

type DashboardData = {
  roleCode: string | null;
  quotes: QuoteRow[];
  oversightProjects: OversightRow[];
  serviceReports: ServiceRow[];
};

export function ExternalQuotesPanel() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/external/quotes");
      const data = (await res.json()) as { quotes?: QuoteRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load quotes");
        return;
      }
      setQuotes(data.quotes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading quotes…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Yard</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quote total</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No quote invitations matched your profile email yet.
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => (
                <TableRow key={q.inviteId}>
                  <TableCell>{q.projectName}</TableCell>
                  <TableCell>{q.yardName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{q.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {q.quoteTotal != null
                      ? new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: q.currency ?? "USD",
                        }).format(q.quoteTotal)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/quote/${q.token}`} className="text-sm text-primary hover:underline">
                      Open quote
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ExternalOversightPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/external/dashboard");
        const json = (await res.json()) as DashboardData & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "Failed to load portal data");
          return;
        }
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading portal data…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.oversightProjects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active dry dock projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Planned start</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.oversightProjects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.code ?? p.id.slice(0, 8)}</TableCell>
                    <TableCell>{p.vesselName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.plannedStart ? new Date(p.plannedStart).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {data.serviceReports.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service / maker attendance jobs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Workshop</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.serviceReports.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      {j.jobCode ?? j.id.slice(0, 8)} — {j.jobTitle}
                    </TableCell>
                    <TableCell>{j.workshopSlug}</TableCell>
                    <TableCell className="tabular-nums">{j.progressPct}%</TableCell>
                    <TableCell>
                      <Badge variant="outline">{j.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {data.oversightProjects.length === 0 && data.serviceReports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No oversight projects or service jobs are visible for role {data.roleCode ?? "external"}.
        </p>
      ) : null}
    </div>
  );
}
