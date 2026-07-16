"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BookOpen, ExternalLink, Search } from "lucide-react";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications-access";

type PackRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  primaryPartNumber?: string | null;
  qualityScorePercent: number;
  vendorPublished: boolean;
  versionNumber: number;
  updatedAt: string;
  vessel?: { name: string; code: string } | null;
  machinery?: { code: string; name: string } | null;
  _count?: { entityLinks: number; requisitionLinks: number };
};

type LibraryStats = {
  total: number;
  active: number;
  vendorPublished: number;
  promotedFromClarifications: number;
  openClarifications: number;
};

export default function KnowledgeLibraryPageWrapper() {
  return (
    <Suspense fallback={<div className="container py-12 text-muted-foreground">Loading…</div>}>
      <KnowledgeLibraryPage />
    </Suspense>
  );
}

function KnowledgeLibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [partFilter, setPartFilter] = useState(searchParams.get("partNumber") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [publishedFilter, setPublishedFilter] = useState(searchParams.get("published") || "all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await fetch("/api/profile/basic", { credentials: "include" });
      if (profile.ok) {
        const p = await profile.json();
        if (!canManagePurchaseClarifications(p.user?.designationAccessLevel)) {
          setAccessDenied(true);
          return;
        }
      }

      const params = new URLSearchParams({ stats: "1" });
      if (partFilter.trim()) params.set("partNumber", partFilter.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (publishedFilter === "published") params.set("vendorPublished", "true");
      if (publishedFilter === "draft") params.set("vendorPublished", "false");

      const res = await fetch(`/api/knowledge-packs?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setPacks(data.packs || []);
      setStats(data.stats || null);
    } catch {
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [partFilter, statusFilter, publishedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (accessDenied) {
    return (
      <div className="container max-w-3xl py-12 text-center">
        <p>You do not have access to the knowledge library.</p>
        <Button className="mt-4" onClick={() => router.push("/purchase/view-requisitions")}>
          Back to requisitions
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchase/clarifications">RFQ clarifications</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge library
          </CardTitle>
          <CardDescription>
            Reusable part knowledge from RFQ clarifications. OTP approval required before vendors can
            see a pack.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <Stat label="Total packs" value={stats.total} />
              <Stat label="Active" value={stats.active} />
              <Stat label="Vendor published" value={stats.vendorPublished} />
              <Stat label="From clarifications" value={stats.promotedFromClarifications} />
              <Stat label="Open clarifications" value={stats.openClarifications} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filter by part number…"
                value={partFilter}
                onChange={(e) => setPartFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={publishedFilter} onValueChange={setPublishedFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Vendor visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="published">Published to vendors</SelectItem>
                <SelectItem value="draft">Internal only</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void load()}>Apply</Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No knowledge packs yet. Promote an answered RFQ clarification to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{pack.title}</span>
                      <Badge variant="outline">{pack.status}</Badge>
                      {pack.vendorPublished ? (
                        <Badge className="bg-green-600">Vendor published</Badge>
                      ) : (
                        <Badge variant="secondary">Internal</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pack.primaryPartNumber || "No part number"}
                      {pack.machinery && ` · ${pack.machinery.code}`}
                      {pack.vessel && ` · ${pack.vessel.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quality {pack.qualityScorePercent}% · v{pack.versionNumber} ·{" "}
                      {pack._count?.entityLinks ?? 0} links · Updated{" "}
                      {new Date(pack.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link href={`/purchase/knowledge-library/${pack.id}`}>
                      View <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
