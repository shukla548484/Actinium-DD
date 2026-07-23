"use client";

import { useEffect, useState } from "react";
import { FileText, ImageIcon, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { Badge } from "@/components/ui/badge";
import type { VesselJobAttachmentMeta } from "@/lib/db/vesselJobAttachments";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { JOB_REQUIREMENT_OPTIONS } from "@/lib/vessel/jobRequirements";
import { conditionRatingLabel } from "@/lib/vessel/machinery/parameters";
import { VESSEL_JOB_ASSIGNED_PARTY_LABELS } from "@/lib/superintendent/constants";
import { cn } from "@/lib/utils";

type Props = {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional seed from the list row while the full job loads. */
  previewTitle?: string;
};

function blank(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-sm text-foreground", multiline && "whitespace-pre-wrap")}>
        {value}
      </p>
    </div>
  );
}

function isImageAttachment(a: VesselJobAttachmentMeta): boolean {
  if (a.mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.fileName);
}

function isVideoAttachment(a: VesselJobAttachmentMeta): boolean {
  if (a.mimeType?.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(a.fileName);
}

export function ShipJobScopeDialog({ jobId, open, onOpenChange, previewTitle }: Props) {
  const [job, setJob] = useState<DdVesselJobDto | null>(null);
  const [attachments, setAttachments] = useState<VesselJobAttachmentMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !jobId) {
      setJob(null);
      setAttachments([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [jobRes, attRes] = await Promise.all([
          fetch(`/api/ship-access/jobs/${jobId}`),
          fetch(`/api/ship-access/vessel-jobs/${jobId}/attachments`),
        ]);
        const jobData = (await jobRes.json()) as { vesselJob?: DdVesselJobDto; error?: string };
        const attData = (await attRes.json()) as { attachments?: VesselJobAttachmentMeta[] };

        if (cancelled) return;

        if (!jobRes.ok || !jobData.vesselJob) {
          setError(jobData.error ?? "Could not load job scope");
          setJob(null);
          setAttachments([]);
          return;
        }

        setJob(jobData.vesselJob);
        const fromApi = attData.attachments ?? [];
        const fromJob = jobData.vesselJob.attachmentMeta ?? [];
        setAttachments(fromApi.length > 0 ? fromApi : fromJob);
      } catch {
        if (!cancelled) {
          setError("Could not load job scope");
          setJob(null);
          setAttachments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, open]);

  const requirements = Array.isArray(job?.formData?.jobRequirements)
    ? (job!.formData!.jobRequirements as string[])
    : [];
  const requirementLabels = JOB_REQUIREMENT_OPTIONS.filter((o) =>
    requirements.includes(o.key),
  ).map((o) => o.label);

  const measurements =
    job?.measurements && typeof job.measurements === "object"
      ? Object.entries(job.measurements).filter(([, v]) => v != null && String(v).trim() !== "")
      : [];

  const images = attachments.filter(isImageAttachment);
  const videos = attachments.filter(isVideoAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a) && !isVideoAttachment(a));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,880px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-5">
          <DialogTitle className="text-base leading-snug sm:text-lg">
            {job?.title ?? previewTitle ?? "Job scope"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {job?.jobCode ? (
              <span className="font-mono text-xs font-medium text-foreground">{job.jobCode}</span>
            ) : null}
            {job ? (
              <>
                <span>·</span>
                <span className="capitalize">{job.status.replace(/_/g, " ")}</span>
                <span>·</span>
                <span className="capitalize">{job.priority}</span>
                {job.assignedParty ? (
                  <>
                    <span>·</span>
                    <span>{VESSEL_JOB_ASSIGNED_PARTY_LABELS[job.assignedParty]}</span>
                  </>
                ) : null}
              </>
            ) : (
              <span>Full scope of work and attachments</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <ActiniumLoadingState label="Loading scope…" size="sm" minHeight={160} />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : job ? (
            <div className="space-y-6">
              <Section title="Job details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Vessel" value={`${job.vesselName} (${job.vesselCode})`} />
                  <Field label="Category / department" value={job.department ?? job.category} />
                  <Field label="Workshop" value={blank(job.workshop)} />
                  <Field
                    label="Machinery path"
                    value={
                      [job.systemKey, job.machineryKey, job.componentKey].filter(Boolean).join(" / ") ||
                      "—"
                    }
                  />
                  <Field
                    label="Condition"
                    value={
                      job.conditionRating ? conditionRatingLabel(job.conditionRating) : "—"
                    }
                  />
                  <Field
                    label="Submitted"
                    value={
                      job.submittedAt
                        ? new Date(job.submittedAt).toLocaleString()
                        : "—"
                    }
                  />
                </div>
              </Section>

              <Section title="Scope of work">
                <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                  {[
                    job.description,
                    job.conditionDescription,
                    job.observedDefect,
                    job.repairRecommendation,
                    job.replacementParts,
                    job.consumables,
                  ].some((v) => v?.trim()) ? (
                    <>
                      <Field label="Description" value={blank(job.description)} multiline />
                      <Field
                        label="Condition description"
                        value={blank(job.conditionDescription)}
                        multiline
                      />
                      <Field label="Observed defect" value={blank(job.observedDefect)} multiline />
                      <Field
                        label="Repair recommendation"
                        value={blank(job.repairRecommendation)}
                        multiline
                      />
                      <Field
                        label="Replacement parts"
                        value={blank(job.replacementParts)}
                        multiline
                      />
                      <Field label="Consumables" value={blank(job.consumables)} multiline />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No scope details recorded yet.</p>
                  )}
                </div>
              </Section>

              {requirementLabels.length > 0 ? (
                <Section title="Requirements">
                  <div className="flex flex-wrap gap-1.5">
                    {requirementLabels.map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </Section>
              ) : null}

              {(measurements.length > 0 ||
                job.runningHoursAtSurvey != null ||
                job.lastOverhaulDate) && (
                <Section title="Survey / measurements">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Running hours at survey"
                      value={blank(job.runningHoursAtSurvey)}
                    />
                    <Field
                      label="Last overhaul"
                      value={
                        job.lastOverhaulDate
                          ? new Date(job.lastOverhaulDate).toLocaleDateString()
                          : "—"
                      }
                    />
                    {measurements.map(([key, value]) => (
                      <Field key={key} label={key} value={String(value)} />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Estimates & risk">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Estimated manhours" value={blank(job.estimatedManhours)} />
                  <Field
                    label="Estimated cost (USD)"
                    value={
                      job.estimatedCost != null ? job.estimatedCost.toLocaleString() : "—"
                    }
                  />
                  <Field label="Operational risk" value={blank(job.operationalRisk)} />
                  <Field label="Safety risk" value={blank(job.safetyRisk)} />
                  <Field label="Environmental risk" value={blank(job.environmentalRisk)} />
                  <Field label="Criticality" value={blank(job.criticality)} />
                </div>
              </Section>

              <Section title="Attachments">
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No photos or files attached.</p>
                ) : (
                  <div className="space-y-4">
                    {images.length > 0 ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <ImageIcon className="size-3.5" />
                          Images
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {images.map((a) => (
                            <figure
                              key={a.id}
                              className="overflow-hidden rounded-lg border bg-background"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.fileUrl}
                                alt={a.caption || a.fileName}
                                className="max-h-72 w-full object-contain bg-muted/30"
                              />
                              <figcaption className="space-y-0.5 border-t px-2.5 py-2 text-xs">
                                <p className="truncate font-medium">{a.fileName}</p>
                                {a.caption ? (
                                  <p className="text-muted-foreground">{a.caption}</p>
                                ) : null}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {videos.length > 0 ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Paperclip className="size-3.5" />
                          Videos
                        </p>
                        <div className="space-y-3">
                          {videos.map((a) => (
                            <div key={a.id} className="overflow-hidden rounded-lg border">
                              <video
                                src={a.fileUrl}
                                controls
                                className="max-h-72 w-full bg-black"
                              />
                              <p className="border-t px-2.5 py-2 text-xs font-medium">
                                {a.fileName}
                                {a.caption ? (
                                  <span className="font-normal text-muted-foreground">
                                    {" "}
                                    · {a.caption}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {files.length > 0 ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <FileText className="size-3.5" />
                          Files
                        </p>
                        <ul className="space-y-2">
                          {files.map((a) => (
                            <li key={a.id}>
                              <a
                                href={a.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-primary hover:bg-muted/40"
                              >
                                <FileText className="mt-0.5 size-4 shrink-0" />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{a.fileName}</span>
                                  {a.caption ? (
                                    <span className="block text-xs text-muted-foreground">
                                      {a.caption}
                                    </span>
                                  ) : null}
                                  {a.mimeType?.includes("pdf") ? (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      Opens in a new tab · also available below
                                    </span>
                                  ) : null}
                                </span>
                              </a>
                              {a.mimeType?.includes("pdf") || /\.pdf$/i.test(a.fileName) ? (
                                <iframe
                                  title={a.fileName}
                                  src={a.fileUrl}
                                  className="mt-2 h-72 w-full rounded-md border bg-muted/20"
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </Section>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
