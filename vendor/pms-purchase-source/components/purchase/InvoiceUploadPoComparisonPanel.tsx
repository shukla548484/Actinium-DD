"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ActiniumLoader from "@/components/ActiniumLoader";
import { formatCurrency } from "@/lib/utils/currency-shared";
import { isDeliveryNoteUploaded } from "@/lib/purchase/delivery-note-status";
import { BudgetClassificationBadge } from "@/components/purchase/BudgetClassificationBadge";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Package,
  Ship,
} from "lucide-react";

export type InvoiceUploadPoContext = {
  purchaseOrder: {
    id: string;
    poNumber: string;
    poType: string;
    totalAmount: number | null;
    currency: string;
    dateOfIssue: string | null;
    completionStatus: string;
    isBudgeted?: boolean | null;
  };
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string;
    requisitionType: string;
    isBudgeted?: boolean | null;
    vessel: { id: string; name: string; code: string };
  };
  quote: {
    id: string;
    quoteNumber: string | null;
    totalAmount: number | null;
    currency: string;
    vendor: { id: string; name: string };
  };
  deliveryNote: {
    id: string;
    deliveryNoteNumber: string;
    deliveryDate: string | null;
    status: string;
    uploadedAt: string | null;
    verifiedAt: string | null;
    hasFile: boolean;
    fileName: string | null;
    hasReceiptConfirmation: boolean;
    receiptConfirmedAt: string | null;
    receiptOverallStatus: string | null;
  } | null;
  vesselConfirmedAmount: number | null;
  isUnbudgeted?: boolean;
  effectiveIsBudgeted?: boolean | null;
};

type Props = {
  context: InvoiceUploadPoContext | null;
  loading: boolean;
  invoiceAmount?: string;
  invoiceCurrency?: string;
  invoiceDate?: string;
};

function formatOptional(amount: number | null | undefined, currency: string) {
  if (amount == null || Number.isNaN(amount)) return "—";
  return formatCurrency(amount, currency);
}

function useConvertedAmount(
  amount: number | null,
  fromCurrency: string,
  toCurrency: string,
  asOfDate?: string
) {
  const [converted, setConverted] = useState<{ amount: number; rate: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const needsConversion =
    amount != null && !Number.isNaN(amount) && from !== to;

  useEffect(() => {
    if (!needsConversion) {
      setConverted(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      amount: String(amount),
      fromCurrency: from,
      toCurrency: to,
    });
    if (asOfDate) params.set("asOfDate", asOfDate);

    fetch(`/api/exchange-rates/convert?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || data.details || "Conversion failed");
        }
        return res.json();
      })
      .then((data: { convertedAmount?: number; rate?: number }) => {
        if (cancelled) return;
        if (data.convertedAmount == null) {
          throw new Error("No converted amount returned");
        }
        setConverted({ amount: data.convertedAmount, rate: data.rate ?? 1 });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConverted(null);
        setError(err instanceof Error ? err.message : "Could not convert currency");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsConversion, amount, from, to, asOfDate]);

  const displayAmount =
    amount == null || Number.isNaN(amount)
      ? null
      : from === to
        ? amount
        : converted?.amount ?? null;

  return { displayAmount, rate: converted?.rate ?? null, loading: needsConversion && loading, error };
}

function dnStatusBadge(status: string | null | undefined) {
  if (!status || !isDeliveryNoteUploaded(status)) {
    if (status === "REJECTED") {
      return <Badge variant="destructive">Rejected — re-upload required</Badge>;
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Not uploaded
      </Badge>
    );
  }
  if (status === "VERIFIED") {
    return (
      <Badge className="bg-success text-white gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Uploaded & verified
      </Badge>
    );
  }
  return (
    <Badge className="bg-success text-white gap-1">
      <FileText className="h-3 w-3" />
      Uploaded — ready for invoice
    </Badge>
  );
}

function ComparisonRow({
  label,
  referenceLabel,
  referenceValue,
  invoiceValue,
  invoiceSubtext,
  highlight,
}: {
  label: string;
  referenceLabel: string;
  referenceValue: React.ReactNode;
  invoiceValue?: React.ReactNode;
  invoiceSubtext?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 rounded-md border px-3 py-2 text-sm ${
        highlight ? "border-amber-300 bg-amber-50/80" : "border-border"
      }`}
    >
      <div>
        <div className="text-xs text-muted-foreground">{referenceLabel}</div>
        <div className="font-medium">{referenceValue}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Your invoice entry</div>
        <div className="font-medium">{invoiceValue ?? "—"}</div>
        {invoiceSubtext ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{invoiceSubtext}</div>
        ) : null}
      </div>
      <div className="col-span-2 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function invoiceEntrySubtext(
  enteredAmount: number | null,
  enteredCurrency: string,
  targetCurrency: string,
  rate: number | null
) {
  if (enteredAmount == null || Number.isNaN(enteredAmount)) return undefined;
  if (enteredCurrency.toUpperCase() === targetCurrency.toUpperCase()) return undefined;
  return (
    <>
      Entered: {formatOptional(enteredAmount, enteredCurrency)}
      {rate != null && rate !== 1 ? (
        <> · Rate: 1 {enteredCurrency.toUpperCase()} = {rate.toFixed(4)} {targetCurrency.toUpperCase()}</>
      ) : null}
    </>
  );
}

function invoiceEntryNode(
  displayAmount: number | null,
  targetCurrency: string,
  loading: boolean,
  needsConversion: boolean
) {
  if (loading && needsConversion) {
    return <span className="text-muted-foreground">Converting…</span>;
  }
  if (displayAmount != null) {
    return formatOptional(displayAmount, targetCurrency);
  }
  return "—";
}

async function downloadDeliveryNoteFile(deliveryNoteId: string, fileName?: string | null) {
  const response = await fetch(`/api/delivery-notes/${deliveryNoteId}/download`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to download delivery note");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "delivery-note.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function InvoiceUploadPoComparisonPanel({
  context,
  loading,
  invoiceAmount,
  invoiceCurrency,
  invoiceDate,
}: Props) {
  const poCurrency = useMemo(() => {
    if (!context) return "USD";
    return (context.purchaseOrder.currency || "USD").toUpperCase();
  }, [context]);

  const invoiceCur = (invoiceCurrency || poCurrency).toUpperCase();
  const invoiceAmt =
    invoiceAmount && invoiceAmount.trim() !== "" ? Number(invoiceAmount) : null;

  const poConversion = useConvertedAmount(invoiceAmt, invoiceCur, poCurrency, invoiceDate);

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border bg-muted/30 p-6">
        <ActiniumLoader size="md" text="Loading PO details…" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        <Package className="mb-3 h-10 w-10 opacity-40" />
        Select a purchase order to compare invoice details against the PO before uploading.
      </div>
    );
  }

  const poAmt = context.purchaseOrder.totalAmount;
  const vesselAmt = context.vesselConfirmedAmount;
  const dnReady =
    context.deliveryNote != null &&
    isDeliveryNoteUploaded(context.deliveryNote.status);

  const poNeedsConversion = invoiceCur !== poCurrency;

  const amountMismatch =
    poConversion.displayAmount != null &&
    poAmt != null &&
    !poConversion.loading &&
    !poConversion.error &&
    Math.abs(poConversion.displayAmount - poAmt) > 0.01;

  const vesselMismatch =
    poConversion.displayAmount != null &&
    vesselAmt != null &&
    !poConversion.loading &&
    !poConversion.error &&
    Math.abs(poConversion.displayAmount - vesselAmt) > 0.01;

  const difference =
    poConversion.displayAmount != null && poAmt != null
      ? poConversion.displayAmount - poAmt
      : null;

  const conversionError = poConversion.error;

  return (
    <div className="flex h-full flex-col rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">PO comparison</h3>
            <p className="text-xs text-muted-foreground">
              Review PO issued amount, DN, and vessel receipt before uploading the invoice.
            </p>
          </div>
        </div>
        <div
          className={`rounded-md border px-3 py-2 ${
            context.effectiveIsBudgeted === true
              ? "border-emerald-400 bg-emerald-50/90"
              : context.effectiveIsBudgeted === false
                ? "border-red-400 bg-red-50/90"
                : "border-slate-300 bg-slate-50"
          }`}
        >
          <div className="text-xs font-medium text-muted-foreground">PO budget classification</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <BudgetClassificationBadge
              isBudgeted={context.effectiveIsBudgeted}
              size="lg"
              showPoLabel
            />
            {context.effectiveIsBudgeted === false ? (
              <span className="text-xs font-medium text-red-900">
                Owner&apos;s approval required on invoice upload
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">PO Number</Label>
            <div className="font-medium">{context.purchaseOrder.poNumber}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Vendor</Label>
            <div>{context.quote.vendor.name}</div>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">Requisition</Label>
            <div>
              {context.requisition.requisitionNumber} — {context.requisition.heading}
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
            <Ship className="h-4 w-4" />
            {context.requisition.vessel.name} ({context.requisition.vessel.code})
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">PO currency</Label>
            <div className="font-medium">{poCurrency}</div>
          </div>
        </div>

        <Separator className="my-3" />

        <ComparisonRow
          label={`PO issued amount (in ${poCurrency})`}
          referenceLabel="PO issued amount"
          referenceValue={formatOptional(poAmt, poCurrency)}
          invoiceValue={invoiceEntryNode(
            poConversion.displayAmount,
            poCurrency,
            poConversion.loading,
            poNeedsConversion
          )}
          invoiceSubtext={invoiceEntrySubtext(
            invoiceAmt,
            invoiceCur,
            poCurrency,
            poConversion.rate
          )}
          highlight={amountMismatch}
        />
        <ComparisonRow
          label={`Vessel confirmed amount (in ${poCurrency})`}
          referenceLabel="Onboard receipt total"
          referenceValue={formatOptional(vesselAmt, poCurrency)}
          invoiceValue={invoiceEntryNode(
            poConversion.displayAmount,
            poCurrency,
            poConversion.loading,
            poNeedsConversion
          )}
          invoiceSubtext={
            vesselAmt == null
              ? "No onboard receipt confirmed yet"
              : invoiceEntrySubtext(invoiceAmt, invoiceCur, poCurrency, poConversion.rate)
          }
          highlight={vesselMismatch}
        />

        <Separator className="my-3" />

        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Delivery note</Label>
            {dnStatusBadge(context.deliveryNote?.status)}
          </div>
          {context.deliveryNote && dnReady ? (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">DN #:</span>{" "}
                {context.deliveryNote.deliveryNoteNumber}
              </div>
              {context.deliveryNote.hasFile && (
                <div className="text-xs text-muted-foreground">
                  File:{" "}
                  <button
                    type="button"
                    className="text-info underline hover:text-info/80"
                    onClick={() => {
                      void downloadDeliveryNoteFile(
                        context.deliveryNote!.id,
                        context.deliveryNote!.fileName
                      ).catch(() => {
                        window.alert("Failed to download delivery note");
                      });
                    }}
                  >
                    {context.deliveryNote.fileName || "Download delivery note"}
                  </button>
                </div>
              )}
              {context.deliveryNote.hasReceiptConfirmation ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Onboard receipt confirmed
                  {context.deliveryNote.receiptOverallStatus
                    ? ` (${context.deliveryNote.receiptOverallStatus.replace(/_/g, " ")})`
                    : ""}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-destructive">
              No delivery note uploaded yet. Upload DN on DN Status before invoicing.
            </p>
          )}
        </div>

        {conversionError && (
          <p className="text-xs text-destructive">{conversionError}</p>
        )}

        {difference != null &&
          !poConversion.loading &&
          !poConversion.error &&
          poAmt != null && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                Math.abs(difference) > 0.01
                  ? "border-amber-300 bg-amber-50/80 text-amber-900"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <div className="font-medium">Difference (invoice vs PO issued amount)</div>
              <div className="mt-1">
                {difference > 0 ? "+" : difference < 0 ? "−" : ""}
                {formatCurrency(Math.abs(difference), poCurrency)}{" "}
                <span className="text-xs">({poCurrency})</span>
              </div>
              {Math.abs(difference) <= 0.01 ? (
                <p className="mt-1 text-xs">Invoice amount matches PO issued amount.</p>
              ) : (
                <p className="mt-1 text-xs">
                  Invoice {difference > 0 ? "exceeds" : "is below"} PO issued amount by{" "}
                  {formatCurrency(Math.abs(difference), poCurrency)} ({poCurrency}).
                </p>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
