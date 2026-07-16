"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { toast } from "sonner";

export type InvoiceEmailRecipientType = "supplier" | "vessel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  recipientType: InvoiceEmailRecipientType;
  poNumber: string;
  invoiceNumber: string;
  supplierName: string;
  vesselName: string;
  defaultSubject?: string;
};

export function InvoiceEmailDialog({
  open,
  onOpenChange,
  invoiceId,
  recipientType,
  poNumber,
  invoiceNumber,
  supplierName,
  vesselName,
  defaultSubject,
}: Props) {
  const buildDefaultSubject = () =>
    defaultSubject ?? `${vesselName} — PO ${poNumber}`;

  const buildDefaultBody = () =>
    recipientType === "supplier"
      ? `Dear ${supplierName},\n\nRegarding invoice ${invoiceNumber} for ${vesselName}, PO ${poNumber}.\n\n`
      : `Dear Master / Vessel team,\n\nRegarding invoice ${invoiceNumber} for ${vesselName}, PO ${poNumber}.\n\n`;

  const [subject, setSubject] = useState(buildDefaultSubject);
  const [body, setBody] = useState(buildDefaultBody);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(buildDefaultSubject());
    setBody(buildDefaultBody());
  }, [
    open,
    recipientType,
    poNumber,
    invoiceNumber,
    supplierName,
    vesselName,
    defaultSubject,
  ]);

  const title =
    recipientType === "supplier" ? "Email to supplier" : "Email to vessel";

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }
      toast.success(
        recipientType === "supplier"
          ? "Email sent to supplier"
          : "Email sent to vessel"
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send email"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Sent from invoicing@actinium-sm.org via Resend. Recipients are asked not
            to reply by email — responses must be made in the Actinium-sm app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">PO</span>
              <p className="font-medium">{poNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Invoice</span>
              <p className="font-medium">{invoiceNumber}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Supplier</span>
              <p className="font-medium">{supplierName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vessel</span>
              <p className="font-medium">{vesselName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-subject">Email subject</Label>
            <Input
              id="invoice-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-body">Email body</Label>
            <Textarea
              id="invoice-email-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start your message here…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending}>
            {sending ? "Sending…" : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
