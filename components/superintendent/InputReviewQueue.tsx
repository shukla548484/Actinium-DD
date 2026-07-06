"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InputReadinessReport, InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import type { InputSectionDef } from "@/lib/superintendent/inputCatalog/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  dryDockProjectId: string;
};

export function InputReviewQueue({ dryDockProjectId }: Props) {
  const [submissions, setSubmissions] = useState<InputSubmissionDto[]>([]);
  const [catalog, setCatalog] = useState<InputSectionDef[]>([]);
  const [readiness, setReadiness] = useState<InputReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const pageKeys = ["vessel", "superintendent", "workshop", "procurement", "closeout"] as const;
    const results = await Promise.all(
      pageKeys.map((pk) =>
        fetch(`/api/superintendent/projects/${dryDockProjectId}/inputs?pageKey=${pk}`).then((r) =>
          r.json(),
        ),
      ),
    );
    const allSubmissions: InputSubmissionDto[] = [];
    const allCatalog: InputSectionDef[] = [];
    let vesselReadiness: InputReadinessReport | null = null;
    for (const json of results) {
      allSubmissions.push(...(json.submissions ?? []));
      allCatalog.push(...(json.catalog ?? []));
      if (json.readiness?.pageKey === "vessel") vesselReadiness = json.readiness;
    }
    setSubmissions(allSubmissions);
    setCatalog(allCatalog);
    setReadiness(vesselReadiness);
    setLoading(false);
  }, [dryDockProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const labelFor = (key: string) => catalog.find((c) => c.key === key)?.label ?? key;

  const pending = submissions.filter(
    (s) => s.status === "submitted" || s.status === "reviewed",
  );

  const review = async (sectionKey: string, action: "approve" | "reject" | "review") => {
    setActing(sectionKey);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/${sectionKey}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reviewerName: reviewerName || null,
            reviewNotes: reviewNotes[sectionKey] || null,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Review failed");
      }
      await load();
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <ActiniumLoadingState label="Loading review queue…" size="sm" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="reviewerName">Reviewer name</Label>
          <Input
            id="reviewerName"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Superintendent"
            className="w-64"
          />
        </div>
        {readiness ? (
          <p className="text-sm text-muted-foreground">
            {readiness.pendingReview} pending · {readiness.approved} approved ·{" "}
            {readiness.completionPct}% complete
          </p>
        ) : null}
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No submissions awaiting review.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{labelFor(sub.sectionKey)}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal capitalize">
                    {sub.status}
                  </span>
                </CardTitle>
                {sub.enteredByName ? (
                  <p className="text-sm text-muted-foreground">Submitted by {sub.enteredByName}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(sub.valuesJson).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-medium capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                      <dd className="text-muted-foreground whitespace-pre-wrap">{String(v ?? "—")}</dd>
                    </div>
                  ))}
                </dl>
                <div className="space-y-2">
                  <Label htmlFor={`notes-${sub.sectionKey}`}>Review notes</Label>
                  <Textarea
                    id={`notes-${sub.sectionKey}`}
                    rows={2}
                    value={reviewNotes[sub.sectionKey] ?? ""}
                    onChange={(e) =>
                      setReviewNotes((prev) => ({ ...prev, [sub.sectionKey]: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === sub.sectionKey}
                    onClick={() => void review(sub.sectionKey, "review")}
                  >
                    Mark reviewed
                  </Button>
                  <Button
                    size="sm"
                    disabled={acting === sub.sectionKey}
                    onClick={() => void review(sub.sectionKey, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={acting === sub.sectionKey}
                    onClick={() => void review(sub.sectionKey, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
