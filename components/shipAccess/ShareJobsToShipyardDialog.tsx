"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SHIPYARD_DOCK_CYCLE_LABELS } from "@/lib/shipyard/quotationCategories";
import { notify } from "@/lib/notify";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

type YardOption = {
  id: string;
  name: string;
  code: string;
  contactEmail: string | null;
  contactPerson: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobIds: string[];
  vesselId: string | null;
  onShared?: () => void;
};

const DOCK_CYCLE_ITEMS = Object.entries(SHIPYARD_DOCK_CYCLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ShareJobsToShipyardDialog({
  open,
  onOpenChange,
  jobIds,
  vesselId,
  onShared,
}: Props) {
  const [yards, setYards] = useState<YardOption[]>([]);
  const [yardCompanyId, setYardCompanyId] = useState("");
  const [dockCycle, setDockCycle] = useState("other");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingYards, setLoadingYards] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mailto, setMailto] = useState<string | null>(null);
  const [portalPath, setPortalPath] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMailto(null);
    setPortalPath(null);
    setReferenceCode(null);
    setLoadingYards(true);
    void fetch("/api/ship-access/jobs/share-quotation")
      .then(async (res) => {
        const data = (await res.json()) as { yards?: YardOption[]; error?: string };
        if (!res.ok) {
          notify.error(data.error ?? "Failed to load shipyards");
          setYards([]);
          return;
        }
        setYards(data.yards ?? []);
        if (data.yards?.[0]) setYardCompanyId(data.yards[0].id);
      })
      .finally(() => setLoadingYards(false));
  }, [open]);

  const yardItems = mapSelectItems(
    yards,
    (y) => y.id,
    (y) => `${y.name} (${y.code})${y.contactEmail ? "" : " — no email"}`,
  );

  const submit = useCallback(async () => {
    if (!vesselId) {
      notify.warning("Select a vessel first");
      return;
    }
    if (jobIds.length === 0) {
      notify.warning("Select one or more jobs");
      return;
    }
    if (!yardCompanyId) {
      notify.warning("Choose a shipyard");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/ship-access/jobs/share-quotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobIds,
          vesselId,
          yardCompanyId,
          dockCycle,
          dueAt: dueAt || null,
          notes: notes || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        mailto?: string | null;
        portalPath?: string;
        request?: { referenceCode: string };
      };
      if (!res.ok) {
        notify.error(data.error ?? "Failed to share jobs");
        return;
      }
      notify.success(data.message ?? "Quotation request created");
      setMailto(data.mailto ?? null);
      setPortalPath(data.portalPath ?? null);
      setReferenceCode(data.request?.referenceCode ?? null);
      onShared?.();
    } finally {
      setSubmitting(false);
    }
  }, [dockCycle, dueAt, jobIds, notes, onShared, vesselId, yardCompanyId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share to shipyard for quotation</DialogTitle>
          <DialogDescription>
            Send {jobIds.length} selected job{jobIds.length === 1 ? "" : "s"} as a quotation
            request. The yard receives a platform invite (mailto + link).
          </DialogDescription>
        </DialogHeader>

        {referenceCode ? (
          <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
            <p>
              Request <span className="font-mono font-medium">{referenceCode}</span> created.
            </p>
            {portalPath ? (
              <p className="break-all text-xs text-muted-foreground">
                Invite link: {typeof window !== "undefined" ? window.location.origin : ""}
                {portalPath}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {mailto ? (
                <Button render={<a href={mailto} />} nativeButton={false}>
                  Open email to yard
                </Button>
              ) : (
                <p className="text-xs text-amber-700">
                  Yard has no contact email — copy the invite link manually.
                </p>
              )}
              {portalPath ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}${portalPath}`;
                    void navigator.clipboard.writeText(url);
                    notify.success("Invite link copied");
                  }}
                >
                  Copy invite link
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Shipyard</p>
              <LabeledSelect
                items={yardItems.length ? yardItems : [{ value: "", label: "No shipyards found" }]}
                value={yardCompanyId}
                onValueChange={setYardCompanyId}
                disabled={loadingYards || yards.length === 0}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Dry dock cycle</p>
              <LabeledSelect
                items={DOCK_CYCLE_ITEMS}
                value={dockCycle}
                onValueChange={setDockCycle}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Quote due date</p>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Notes to yard</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional message included with the request"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {referenceCode ? "Close" : "Cancel"}
          </Button>
          {!referenceCode ? (
            <Button disabled={submitting || yards.length === 0} onClick={() => void submit()}>
              {submitting ? "Sharing…" : "Create & share"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
