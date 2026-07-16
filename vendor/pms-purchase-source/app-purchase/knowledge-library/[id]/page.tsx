"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Archive,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type EntityLink = {
  id: string;
  entityType: string;
  entityId: string;
  linkRole: string;
  displayName: string;
  href: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  createdAt: string;
};

export default function KnowledgePackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const packId = params.id as string;

  const [pack, setPack] = useState<any>(null);
  const [entityLinks, setEntityLinks] = useState<EntityLink[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge-packs/${packId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setPack(data.pack);
      setEntityLinks(data.entityLinks || []);
      setAuditEvents(data.auditEvents || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestOtp = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge-packs/${packId}/publish/request-otp`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(data.message || "Check your notifications for the verification code.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmPublish = async () => {
    if (!otpCode.trim()) {
      toast.error("Enter the verification code");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge-packs/${packId}/publish/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Published to vendors");
      setOtpCode("");
      void load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!confirm("Archive this knowledge pack? It will be hidden from vendors.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge-packs/${packId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Knowledge pack archived");
      void load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="container py-12 text-muted-foreground">Loading…</div>;
  }

  if (!pack) {
    return <div className="container py-12">Knowledge pack not found.</div>;
  }

  const canPublish = pack.status === "ACTIVE" && !pack.vendorPublished;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/purchase/knowledge-library">Library</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {pack.title}
            </CardTitle>
            <Badge variant="outline">{pack.status}</Badge>
            {pack.vendorPublished ? (
              <Badge className="bg-green-600 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Vendor published
              </Badge>
            ) : (
              <Badge variant="secondary">Internal only</Badge>
            )}
          </div>
          <CardDescription>
            {pack.primaryPartNumber || "No part number"}
            {pack.drawingNumber && ` · Drawing ${pack.drawingNumber}`}
            {pack.machinery && ` · ${pack.machinery.code} — ${pack.machinery.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pack.summaryText && (
            <p className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/30">
              {pack.summaryText}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Quality score</p>
              <p className="font-medium">{pack.qualityScorePercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium">v{pack.versionNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Requisition links</p>
              <p className="font-medium">{pack._count?.requisitionLinks ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">From clarifications</p>
              <p className="font-medium">{pack._count?.promotedClarifications ?? 0}</p>
            </div>
          </div>

          {canPublish && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Publish to vendors</AlertTitle>
              <AlertDescription className="space-y-3 mt-2">
                <p>
                  Request a one-time verification code (sent via in-app notification), then enter it
                  below to make this pack visible on vendor quote pages.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={() => void requestOtp()} disabled={busy}>
                    Send verification code
                  </Button>
                  <div className="flex gap-2 flex-1">
                    <Input
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      className="max-w-[140px]"
                    />
                    <Button size="sm" variant="secondary" onClick={() => void confirmPublish()} disabled={busy}>
                      Confirm publish
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {pack.vendorPublished && pack.vendorPublishedAt && (
            <p className="text-xs text-muted-foreground">
              Published to vendors {new Date(pack.vendorPublishedAt).toLocaleString()}
              {pack.vendorPublishedBy &&
                ` by ${pack.vendorPublishedBy.firstName} ${pack.vendorPublishedBy.lastName}`}
            </p>
          )}

          {pack.status !== "ARCHIVED" && (
            <Button variant="outline" size="sm" onClick={() => void archive()} disabled={busy}>
              <Archive className="h-4 w-4 mr-1" /> Archive pack
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            Digital twin links
          </CardTitle>
          <CardDescription>Related machinery, requisitions, clarifications, and vendors.</CardDescription>
        </CardHeader>
        <CardContent>
          {entityLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entity links yet.</p>
          ) : (
            <div className="space-y-2">
              {entityLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
                >
                  <div>
                    <Badge variant="outline" className="mr-2">
                      {link.linkRole}
                    </Badge>
                    <span className="text-muted-foreground">{link.entityType}</span>
                    <span className="mx-2">·</span>
                    <span>{link.displayName}</span>
                  </div>
                  {link.href && link.href.startsWith("/") && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={link.href}>
                        Open <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(pack.facts?.length > 0 || pack.assets?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pack.facts?.length > 0 && (
              <div className="space-y-2">
                <Label>Facts</Label>
                {pack.facts.map((f: any) => (
                  <div key={f.id} className="rounded border p-3 text-sm">
                    <p className="font-medium">{f.label}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
            {pack.assets?.length > 0 && (
              <div className="space-y-2">
                <Label>Attachments ({pack.assets.length})</Label>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {pack.assets.map((a: any) => (
                    <li key={a.id}>
                      {a.fileName} ({a.assetType})
                      {a.isVendorVisible && " · vendor visible"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {auditEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent audit</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {auditEvents.map((ev) => (
                <li key={ev.id} className="text-muted-foreground">
                  <span className="text-foreground">{ev.action.replace(/_/g, " ")}</span>
                  {" · "}
                  {new Date(ev.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
