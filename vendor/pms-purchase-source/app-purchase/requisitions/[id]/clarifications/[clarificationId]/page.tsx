"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, History, Upload, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  clarificationResponseDueAt,
  isClarificationOverdue,
} from "@/lib/procurement/clarification-escalation-dates";

export default function ClarificationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requisitionId = params.id as string;
  const clarificationId = params.clarificationId as string;
  const view = searchParams.get("view") || "office";
  const fromNotification = searchParams.get("from") === "notification";

  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [canRespond, setCanRespond] = useState(false);
  const [eligibleResponderLevels, setEligibleResponderLevels] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [similarPacks, setSimilarPacks] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rfq-clarifications/${clarificationId}?view=${view}&history=1`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json.clarification);
      setHistory(json.history);
      setCanRespond(Boolean(json.canRespond));
      setEligibleResponderLevels(Array.isArray(json.eligibleResponderLevels) ? json.eligibleResponderLevels : []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [clarificationId, view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view !== "office" || !clarificationId) return;
    void fetch(`/api/rfq-clarifications/${clarificationId}/promote`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setSimilarPacks(json.similarPacks || []))
      .catch(() => setSimilarPacks([]));
  }, [clarificationId, view, data?.status]);

  const respond = async () => {
    if (!responseText.trim()) {
      toast.error("Enter a response");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("responseText", responseText.trim());
      if (file) form.set("files", file);
      const res = await fetch(`/api/rfq-clarifications/${clarificationId}/respond`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Response submitted");
      setResponseText("");
      setFile(null);
      void load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const officeAction = async (action: "reject" | "close" | "promote") => {
    setSubmitting(true);
    try {
      const url =
        action === "promote"
          ? `/api/rfq-clarifications/${clarificationId}/promote`
          : `/api/rfq-clarifications/${clarificationId}/actions`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "promote" ? {} : { action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(
        action === "promote"
          ? "Saved to knowledge pack"
          : action === "close"
            ? "Clarification closed"
            : "Clarification rejected"
      );
      void load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!data) {
    return <div className="p-8">Clarification not found.</div>;
  }

  const isVesselView = view === "vessel";

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {fromNotification && (
          <Link href="/notifications" className="text-sm text-primary underline ml-auto">
            Notifications
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <CardTitle>RFQ clarification</CardTitle>
            <Badge>{data.status}</Badge>
            <Badge variant="outline">{data.requestType?.replace(/_/g, " ")}</Badge>
            {data.status === "OPEN" && data.requestedAt && isClarificationOverdue(data.requestedAt) && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </Badge>
            )}
          </div>
          {data.status === "OPEN" && data.requestedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Response due by {clarificationResponseDueAt(new Date(data.requestedAt)).toLocaleDateString()}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Requisition:{" "}
            <Link href={`/purchase/requisitions/${requisitionId}/view`} className="text-primary underline">
              {data.requisition?.requisitionNumber}
            </Link>
          </p>
          {data.requisitionItem && (
            <p className="text-sm">
              <strong>Item:</strong> {data.requisitionItem.itemName}
              {data.requisitionItem.partNumber && ` (${data.requisitionItem.partNumber})`}
            </p>
          )}
          {!isVesselView && data.vendor && (
            <p className="text-sm">
              <strong>Vendor:</strong> {data.vendor.name}
            </p>
          )}
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium mb-1">Request</p>
            <p className="text-sm">{isVesselView ? data.message : data.message}</p>
          </div>
          {data.responseText && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium mb-1">Response</p>
              <p className="text-sm">{data.responseText}</p>
            </div>
          )}
          {data.attachments?.length > 0 && (
            <ul className="text-sm space-y-1">
              {data.attachments.map((a: any) => (
                <li key={a.id}>
                  {a.fileUrl ? (
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                      {a.fileName}
                    </a>
                  ) : (
                    a.fileName
                  )}{" "}
                  <span className="text-muted-foreground text-xs">({a.role})</span>
                </li>
              ))}
            </ul>
          )}

          {data.status === "OPEN" && isVesselView && eligibleResponderLevels.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Assigned responder ranks for this requisition: {eligibleResponderLevels.join(", ")}
              {!canRespond ? " — your rank is not in this list." : "."}
            </p>
          )}

          {canRespond && (isVesselView || view === "office") && (
            <div className="border-t pt-4 space-y-3">
              <Label>Your response</Label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
                placeholder="Provide the technical information requested…"
              />
              <div>
                <Label>Attach file (optional)</Label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block text-sm mt-1"
                />
              </div>
              <Button onClick={respond} disabled={submitting}>
                <Upload className="h-4 w-4 mr-2" />
                Submit response
              </Button>
            </div>
          )}

          {data.status === "OPEN" && isVesselView && !canRespond && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Awaiting assigned officer</AlertTitle>
              <AlertDescription>
                This request must be answered by access level{" "}
                {eligibleResponderLevels.length ? eligibleResponderLevels.join(" or ") : "an assigned officer"}.
                You can view the request here, but only the assigned rank can submit the reply.
              </AlertDescription>
            </Alert>
          )}

          {view === "office" && !isVesselView && similarPacks.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Similar knowledge pack exists</AlertTitle>
              <AlertDescription>
                {similarPacks.length} active pack(s) already match this part number
                {similarPacks[0]?.machinery?.code ? ` (${similarPacks[0].machinery.code})` : ""}.
                Promoting will merge into an existing pack when the part number matches, or review:{" "}
                {similarPacks.map((p) => p.title).join("; ")}
              </AlertDescription>
            </Alert>
          )}

          {view === "office" && !isVesselView && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {data.status === "OPEN" && (
                <Button variant="outline" onClick={() => officeAction("reject")} disabled={submitting}>
                  Reject request
                </Button>
              )}
              {(data.status === "ANSWERED" || data.status === "OPEN") && (
                <Button variant="outline" onClick={() => officeAction("close")} disabled={submitting}>
                  Close
                </Button>
              )}
              {(data.status === "ANSWERED" || data.status === "CLOSED") && (
                <Button onClick={() => officeAction("promote")} disabled={submitting}>
                  Save to knowledge pack
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {history?.events?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Audit timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.events.slice(0, 15).map((ev: any) => {
              const meta = (ev.metadata ?? {}) as Record<string, unknown>;
              const responderLevel =
                typeof meta.responderAccessLevel === "number"
                  ? meta.responderAccessLevel
                  : ev.action === "CLARIFICATION_ANSWERED" && ev.actorRole
                    ? Number(ev.actorRole)
                    : null;
              return (
              <div key={ev.id} className="text-sm border-b pb-2">
                <span className="font-medium">{ev.action.replace(/_/g, " ")}</span>
                {responderLevel != null && Number.isFinite(responderLevel) && (
                  <span className="text-muted-foreground ml-2">
                    · access level {responderLevel}
                  </span>
                )}
                <span className="text-muted-foreground ml-2">
                  {new Date(ev.occurredAt).toLocaleString()}
                </span>
              </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
