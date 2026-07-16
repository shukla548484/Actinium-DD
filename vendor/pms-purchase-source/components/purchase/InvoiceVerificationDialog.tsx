"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  canApproveContractBasedInvoice,
  isInvoiceBasedContractType,
} from "@/lib/contract-invoice-based";
import { resolveInvoiceDisplayAmounts } from "@/lib/purchase-invoice-currency";
import {
  downloadInvoiceFile,
  openInvoiceFileView,
} from "@/lib/purchase/invoice-file-download-client";
import { RATE_SOURCE_LABELS } from "@/lib/utils/currency-shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  FileText,
  Download,
  Printer,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";
import { PurchaseEntityHistoryPanel } from "@/components/purchase/PurchaseEntityHistoryPanel";
import { PurchaseApprovalMatrix } from "@/components/purchase/PurchaseApprovalMatrix";
import { BudgetClassificationBadge } from "@/components/purchase/BudgetClassificationBadge";
import type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";
import type { PurchaseEntityHistoryEntry } from "@/lib/purchase/build-entity-history";
import { canViewPurchaseEntityHistory } from "@/lib/purchase/can-view-purchase-entity-history";
import {
  DEFAULT_INVOICE_APPROVAL_LEVELS,
  hasUserReturnedInvoiceAwaitingResubmit,
  invoiceNeedsPurchaserCorrection,
  invoicePendingLevelFromStatus,
} from "@/lib/purchase/invoice-access";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadInvoiceVerificationPdf } from "@/lib/purchase/invoice-verification-pdf";
import ActiniumLoader from "@/components/ActiniumLoader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { InvoiceVerificationMode } from "@/lib/purchase/invoice-verification-url";

interface ApprovalStep {
  step: number;
  title: string;
  description: string;
  approverName?: string;
  approvedAt?: string;
  status: "completed" | "current" | "pending";
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  originalInvoiceAmount?: string | null;
  fxRateToUsd?: string | null;
  fxRateSource?: string | null;
  currency: string;
  accountType?: string;
  accountCode?: {
    id: string;
    accountCode: string;
    accountName: string;
  };
  invoiceFileUrl?: string;
  ownerApprovalFileUrl?: string | null;
  ownerApprovalFileName?: string | null;
  status: string;
  currentApprovalLevel?: string;
  levelOneApprovedAt?: string;
  levelOneApprovedBy?: string;
  levelOneApprover?: { firstName: string; lastName: string };
  levelTwoApprovedAt?: string;
  levelTwoApprovedBy?: string;
  levelTwoApprover?: { firstName: string; lastName: string };
  levelThreeApprovedAt?: string;
  levelThreeApprovedBy?: string;
  levelThreeApprover?: { firstName: string; lastName: string };
  levelFourApprovedAt?: string;
  levelFourApprovedBy?: string;
  levelFourApprover?: { firstName: string; lastName: string };
  purchaseOrder?: {
    id: string;
    poNumber: string;
    dateOfIssue: string;
    totalAmount: string;
    currency: string;
    contract?: {
      id: string;
      contractNumber: string;
      contractType: string;
      title: string;
    } | null;
  };
  requisition?: {
    id: string;
    requisitionNumber: string;
    heading: string;
    vessel?: {
      id: string;
      name: string;
      code: string;
      company?: {
        id: string;
        name: string;
        address?: string;
        city?: string;
        country?: string;
      };
    };
  };
  vendor?: {
    id: string;
    name: string;
    primaryEmail?: string;
  };
  quoteAmount?: string;
  differenceAmount?: string;
  discountAmount?: string;
  poAmount?: number | null;
  vesselConfirmedAmount?: number | null;
  hasVesselReceipt?: boolean;
  isBudgeted?: boolean | null;
  effectiveIsBudgeted?: boolean | null;
  createdAt?: string;
  lastReturnedBy?: string | null;
  lastReturnedAt?: string | null;
}

export type { InvoiceVerificationMode } from "@/lib/purchase/invoice-verification-url";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
  mode?: InvoiceVerificationMode;
  fromNotification?: boolean;
  onSuccess?: () => void;
};

export function InvoiceVerificationDialog({
  open,
  onOpenChange,
  invoiceId,
  mode = "view",
  fromNotification = false,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState("");
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnTo, setReturnTo] = useState<string>("");
  const [amountDistribution, setAmountDistribution] = useState<{ [key: string]: string }>({});
  const [invoiceHistory, setInvoiceHistory] = useState<PurchaseEntityHistoryEntry[]>([]);
  const [invoiceHistoryLoading, setInvoiceHistoryLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const canViewHistory = canViewPurchaseEntityHistory(currentUser?.designationAccessLevel);

  const resetState = useCallback(() => {
    setInvoice(null);
    setVerificationRemarks("");
    setShowReturnDialog(false);
    setReturnRemarks("");
    setReturnTo("");
    setAmountDistribution({});
    setInvoiceHistory([]);
  }, []);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setInitialLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        toast.error(errorData.error || errorData.details || "Failed to load invoice");
        onOpenChange(false);
        return;
      }

      const data = await response.json();

      if (!data?.invoice) {
        toast.error("Invalid invoice data received");
        onOpenChange(false);
        return;
      }

      setInvoice(data.invoice);

      if (data.invoice.accountCode) {
        setAmountDistribution({
          [data.invoice.accountCode.accountCode]: data.invoice.invoiceAmount || "0",
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching invoice:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load invoice. Please try again.");
      onOpenChange(false);
    } finally {
      setInitialLoading(false);
    }
  }, [invoiceId, onOpenChange]);

  useEffect(() => {
    if (!open || !invoiceId) {
      if (!open) resetState();
      return;
    }
    void fetchInvoice();
  }, [open, invoiceId, fetchInvoice, resetState]);

  useEffect(() => {
    if (!open || !invoiceId || !canViewHistory) {
      setInvoiceHistory([]);
      return;
    }
    let cancelled = false;
    setInvoiceHistoryLoading(true);
    fetch(`/api/invoices/${invoiceId}/history`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((data) => {
        if (!cancelled) setInvoiceHistory(data.history ?? []);
      })
      .catch(() => {
        if (!cancelled) setInvoiceHistory([]);
      })
      .finally(() => {
        if (!cancelled) setInvoiceHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, canViewHistory]);

  const getApprovalSteps = (): ApprovalStep[] => {
    if (!invoice) return [];

    return [
      {
        step: 1,
        title: "L1 (upload)",
        description: invoice.levelOneApprover
          ? `${invoice.levelOneApprover.firstName} ${invoice.levelOneApprover.lastName}`
          : "Purchaser upload",
        approverName: invoice.levelOneApprover
          ? `${invoice.levelOneApprover.firstName} ${invoice.levelOneApprover.lastName}`
          : undefined,
        approvedAt: invoice.levelOneApprovedAt,
        status: invoice.levelOneApprovedAt
          ? "completed"
          : invoiceNeedsPurchaserCorrection(invoice.status)
            ? "current"
            : "pending",
      },
      {
        step: 2,
        title: "L2",
        description: invoice.levelTwoApprover
          ? `${invoice.levelTwoApprover.firstName} ${invoice.levelTwoApprover.lastName}`
          : "Level 2 Approver",
        approverName: invoice.levelTwoApprover
          ? `${invoice.levelTwoApprover.firstName} ${invoice.levelTwoApprover.lastName}`
          : undefined,
        approvedAt: invoice.levelTwoApprovedAt,
        status: invoice.levelTwoApprovedAt
          ? "completed"
          : invoice.levelOneApprovedAt && invoice.currentApprovalLevel === "LEVEL_TWO"
            ? "current"
            : "pending",
      },
      {
        step: 3,
        title: "L3",
        description: invoice.levelThreeApprover
          ? `${invoice.levelThreeApprover.firstName} ${invoice.levelThreeApprover.lastName}`
          : "Level 3 Approver",
        approverName: invoice.levelThreeApprover
          ? `${invoice.levelThreeApprover.firstName} ${invoice.levelThreeApprover.lastName}`
          : undefined,
        approvedAt: invoice.levelThreeApprovedAt,
        status: invoice.levelThreeApprovedAt
          ? "completed"
          : invoice.levelTwoApprovedAt && invoice.currentApprovalLevel === "LEVEL_THREE"
            ? "current"
            : "pending",
      },
      {
        step: 4,
        title: "L4",
        description: invoice.levelFourApprover
          ? `${invoice.levelFourApprover.firstName} ${invoice.levelFourApprover.lastName}`
          : "Level 4 Approver",
        approverName: invoice.levelFourApprover
          ? `${invoice.levelFourApprover.firstName} ${invoice.levelFourApprover.lastName}`
          : undefined,
        approvedAt: invoice.levelFourApprovedAt,
        status: invoice.levelFourApprovedAt
          ? "completed"
          : invoice.levelThreeApprovedAt && invoice.currentApprovalLevel === "LEVEL_FOUR"
            ? "current"
            : "pending",
      },
    ];
  };

  const isContractBasedInvoice = (): boolean =>
    isInvoiceBasedContractType(invoice?.purchaseOrder?.contract?.contractType);

  const canApprove = (): boolean => {
    if (!currentUser || !invoice) return false;
    if (hasUserReturnedInvoiceAwaitingResubmit(currentUser.id, invoice)) {
      return false;
    }
    const userAccessLevel = currentUser.designationAccessLevel || 0;

    if (isContractBasedInvoice()) {
      return (
        canApproveContractBasedInvoice(userAccessLevel) &&
        (invoice.status === "READY_FOR_APPROVAL" || invoice.status.startsWith("LEVEL_"))
      );
    }

    const pendingLevel = invoicePendingLevelFromStatus(invoice.status);
    if (!pendingLevel) return false;

    const requiredLevels: { [key: number]: number[] } = {
      2: DEFAULT_INVOICE_APPROVAL_LEVELS.level2AccessLevels,
      3: DEFAULT_INVOICE_APPROVAL_LEVELS.level3AccessLevels,
      4: DEFAULT_INVOICE_APPROVAL_LEVELS.level4AccessLevels,
    };

    const required = requiredLevels[pendingLevel] || [];
    return required.includes(userAccessLevel) || isAdminEquivalentAccessLevel(userAccessLevel);
  };

  const canReturn = (): boolean => {
    if (!currentUser || !invoice) return false;
    const userAccessLevel = currentUser.designationAccessLevel || 0;
    const returnLevels = [
      ...DEFAULT_INVOICE_APPROVAL_LEVELS.level2AccessLevels,
      ...DEFAULT_INVOICE_APPROVAL_LEVELS.level3AccessLevels,
      ...DEFAULT_INVOICE_APPROVAL_LEVELS.level4AccessLevels,
    ];
    if (!returnLevels.includes(userAccessLevel) && !isAdminEquivalentAccessLevel(userAccessLevel)) {
      return false;
    }
    return invoicePendingLevelFromStatus(invoice.status) != null;
  };

  const handleVerify = async () => {
    if (!invoiceId || !canApprove()) {
      toast.error("You don't have permission to verify this invoice");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remarks: verificationRemarks }),
      });

      if (response.ok) {
        toast.success("Invoice verified successfully");
        setVerificationRemarks("");
        onSuccess?.();
        if (fromNotification) {
          onOpenChange(false);
          router.push("/notifications");
          return;
        }
        await fetchInvoice();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to verify invoice");
      }
    } catch (error) {
      console.error("Error verifying invoice:", error);
      toast.error("Failed to verify invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!invoiceId || !returnRemarks.trim()) {
      toast.error("Please provide return remarks");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          remarks: returnRemarks,
          returnTo: returnTo || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Invoice returned successfully");
        setShowReturnDialog(false);
        setReturnRemarks("");
        setReturnTo("");
        // Immediately deactivate Verify for this user (return resets to L2-pending).
        if (currentUser?.id) {
          setInvoice((prev) =>
            prev
              ? {
                  ...prev,
                  lastReturnedBy: currentUser.id,
                  lastReturnedAt: new Date().toISOString(),
                  status: "LEVEL_ONE_APPROVED",
                  currentApprovalLevel: "LEVEL_TWO",
                  levelTwoApprovedAt: undefined,
                  levelTwoApprovedBy: undefined,
                  levelThreeApprovedAt: undefined,
                  levelThreeApprovedBy: undefined,
                  levelFourApprovedAt: undefined,
                  levelFourApprovedBy: undefined,
                }
              : prev
          );
        }
        onSuccess?.();
        if (fromNotification) {
          onOpenChange(false);
          router.push("/notifications");
          return;
        }
        await fetchInvoice();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to return invoice");
      }
    } catch (error) {
      console.error("Error returning invoice:", error);
      toast.error("Failed to return invoice");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: string | number, currency: string) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(numAmount);
  };

  const calculatePaymentDue = (): string => {
    if (!invoice?.invoiceDate) return "N/A";
    try {
      const invoiceDate = new Date(invoice.invoiceDate);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);
      return formatDate(dueDate.toISOString());
    } catch {
      return "N/A";
    }
  };

  const isUrgentPayment = (): boolean => {
    if (!invoice?.invoiceDate) return false;
    try {
      const invoiceDate = new Date(invoice.invoiceDate);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const today = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue > 0;
    } catch {
      return false;
    }
  };

  const handleViewAttachment = async (fileUrl: string) => {
    try {
      await openInvoiceFileView(fileUrl);
    } catch (error) {
      console.error("Error viewing attachment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to view attachment");
    }
  };

  const handleDownloadAttachment = async (fileUrl: string, fileName?: string) => {
    try {
      await downloadInvoiceFile(fileUrl, fileName);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download attachment");
    }
  };

  const renderAttachmentLinks = (
    label: string,
    fileUrl?: string | null,
    fileName?: string | null
  ) => {
    if (!fileUrl) {
      return (
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
          <span className="text-sm text-muted-foreground">Not attached</span>
        </div>
      );
    }

    const displayName = fileName?.trim() || label;

    return (
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-success" />
          <button
            type="button"
            onClick={() => void handleViewAttachment(fileUrl)}
            className="font-medium text-info underline hover:text-info/80 print-capture-hide"
          >
            View
          </button>
          <span className="text-muted-foreground print-capture-hide">·</span>
          <button
            type="button"
            onClick={() => void handleDownloadAttachment(fileUrl, displayName)}
            className="font-medium text-info underline hover:text-info/80 print-capture-hide"
          >
            Download
          </button>
          <span className="hidden text-sm text-foreground print-capture-static">{displayName}</span>
          <span className="text-xs text-muted-foreground print-capture-hide">({displayName})</span>
        </div>
      </div>
    );
  };

  const fetchInvoicePdfBuffer = useCallback(async (): Promise<ArrayBuffer | null> => {
    if (!invoice?.invoiceFileUrl) return null;

    try {
      const proxyUrl = `/api/invoices/download?fileUrl=${encodeURIComponent(invoice.invoiceFileUrl)}`;
      const response = await fetch(proxyUrl, { credentials: "include" });
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { downloadUrl?: string };
        if (!data.downloadUrl) return null;
        const remote = await fetch(data.downloadUrl);
        if (!remote.ok) return null;
        const remoteType = remote.headers.get("content-type") || "";
        if (!remoteType.includes("pdf")) return null;
        return remote.arrayBuffer();
      }

      if (!contentType.includes("pdf")) return null;
      return response.arrayBuffer();
    } catch {
      return null;
    }
  }, [invoice?.invoiceFileUrl]);

  const dialogTitle =
    mode === "approve" ? "Invoice Verification & Approval" : "Invoice Details";

  const workflowSteps: PurchaseWorkflowStep[] = invoice
    ? getApprovalSteps().map((step) => ({
        step: step.step,
        title: step.title,
        description: step.description,
        approverName: step.approverName,
        approvedAt: step.approvedAt,
        status: step.status,
      }))
    : [];
  const invoiceReceivedDate = invoice
    ? invoice.createdAt
      ? formatDate(invoice.createdAt)
      : formatDate(invoice.invoiceDate)
    : "";
  const paymentDueDate = invoice ? calculatePaymentDue() : "";
  const urgentPayment = invoice ? isUrgentPayment() : false;
  const displayAmounts = invoice
    ? resolveInvoiceDisplayAmounts({
        invoiceAmount: invoice.invoiceAmount,
        currency: invoice.currency,
        originalInvoiceAmount: invoice.originalInvoiceAmount,
        fxRateToUsd: invoice.fxRateToUsd,
        fxRateSource: invoice.fxRateSource,
      })
    : null;
  const invoiceAmountOriginal = displayAmounts?.originalAmount ?? 0;
  const invoiceAmountUsd = displayAmounts?.usdAmount ?? 0;
  const poCurrency = (
    invoice?.purchaseOrder?.currency || invoice?.currency || "USD"
  ).toUpperCase();
  const vesselConfirmedOriginal =
    invoice?.vesselConfirmedAmount != null && Number.isFinite(Number(invoice.vesselConfirmedAmount))
      ? Number(invoice.vesselConfirmedAmount)
      : null;
  const convertPoCurrencyToUsd = (amount: number | null): number | null => {
    if (amount == null) return null;
    if (poCurrency === "USD") return amount;
    if (
      displayAmounts?.originalCurrency?.toUpperCase() === poCurrency &&
      displayAmounts.fxRateToUsd
    ) {
      return amount * displayAmounts.fxRateToUsd;
    }
    if (displayAmounts?.originalAmount && displayAmounts.originalAmount > 0) {
      return amount * (displayAmounts.usdAmount / displayAmounts.originalAmount);
    }
    return amount;
  };
  const vesselConfirmedUsd = convertPoCurrencyToUsd(vesselConfirmedOriginal);
  const fxRateLabel =
    displayAmounts?.fxRateSource && RATE_SOURCE_LABELS[displayAmounts.fxRateSource]
      ? RATE_SOURCE_LABELS[displayAmounts.fxRateSource]
      : displayAmounts?.fxRateToUsd != null
        ? `Rate: 1 ${displayAmounts.originalCurrency} = ${displayAmounts.fxRateToUsd.toFixed(4)} USD`
        : null;

  const amountDistributionValue =
    invoice?.accountCode
      ? amountDistribution[invoice.accountCode.accountCode] ||
        formatCurrency(invoiceAmountOriginal, displayAmounts?.originalCurrency || invoice.currency)
      : invoice
        ? formatCurrency(invoiceAmountOriginal, displayAmounts?.originalCurrency || invoice.currency)
        : "";

  const budgetClassification =
    invoice?.effectiveIsBudgeted ?? invoice?.isBudgeted ?? null;

  const handlePrintPdf = useCallback(async () => {
    if (!invoice) return;

    setGeneratingPdf(true);
    try {
      const appendPdfBuffers: ArrayBuffer[] = [];
      const invoicePdf = await fetchInvoicePdfBuffer();
      if (invoicePdf) appendPdfBuffers.push(invoicePdf);

      const accountLabel = invoice.accountCode
        ? `${invoice.accountCode.accountCode} - ${invoice.accountCode.accountName}`
        : invoice.accountType || undefined;

      await downloadInvoiceVerificationPdf(
        {
          documentTitle: dialogTitle,
          invoiceNumber: invoice.invoiceNumber,
          vesselName: invoice.requisition?.vessel?.name,
          poNumber: invoice.purchaseOrder?.poNumber,
          workflowSteps,
          invoiceDate: formatDate(invoice.invoiceDate),
          invoiceReceivedDate,
          paymentDueDate,
          urgentPayment,
          supplierName: invoice.vendor?.name,
          amountDistribution: amountDistributionValue,
          accountLabel,
          attachedInvoiceName: invoice.invoiceFileUrl
            ? `invoice-${invoice.invoiceNumber}`
            : undefined,
          ownerApprovalName: invoice.ownerApprovalFileName || undefined,
          invoiceAmountOriginal,
          invoiceAmountUsd,
          originalCurrency: displayAmounts?.originalCurrency || invoice.currency,
          vesselConfirmedOriginal,
          vesselConfirmedUsd,
          poCurrency,
          hasVesselReceipt: invoice.hasVesselReceipt,
          budgetClassification,
          fxRateLabel,
          billingCompany: invoice.requisition?.vessel?.company?.name,
          billingAddress: invoice.requisition?.vessel?.company?.address,
          verificationRemarks: verificationRemarks.trim() || undefined,
          history: canViewHistory ? invoiceHistory : undefined,
        },
        `invoice-${invoice.invoiceNumber || invoice.id}.pdf`,
        appendPdfBuffers.length ? appendPdfBuffers : undefined
      );
      toast.success("PDF downloaded.");
    } catch (error) {
      console.error("Invoice PDF generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }, [
    invoice,
    dialogTitle,
    workflowSteps,
    invoiceReceivedDate,
    paymentDueDate,
    urgentPayment,
    amountDistributionValue,
    invoiceAmountOriginal,
    invoiceAmountUsd,
    displayAmounts?.originalCurrency,
    vesselConfirmedOriginal,
    vesselConfirmedUsd,
    poCurrency,
    fxRateLabel,
    verificationRemarks,
    canViewHistory,
    invoiceHistory,
    budgetClassification,
    fetchInvoicePdfBuffer,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="invoice-verification-dialog !flex max-h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="shrink-0 border-b bg-info px-4 py-2.5 text-white print-capture-hide">
            <div className="flex items-center gap-3">
              <div className="shrink-0 min-w-[11rem]">
                <DialogTitle className="text-lg font-bold leading-tight text-white">
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80">
                  {invoice?.invoiceNumber
                    ? `Invoice ${invoice.invoiceNumber}`
                    : "Review invoice information and approval status"}
                </DialogDescription>
              </div>

              {invoice && !initialLoading ? (
                <div className="min-w-0 flex-1 flex justify-center px-2">
                  <PurchaseApprovalMatrix steps={workflowSteps} variant="topBar" />
                </div>
              ) : (
                <div className="min-w-0 flex-1" />
              )}

              <div className="flex shrink-0 items-center gap-2">
                {invoice ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-white hover:bg-white/15"
                    onClick={() => void handlePrintPdf()}
                    disabled={generatingPdf}
                  >
                    {generatingPdf ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    {generatingPdf ? "Preparing PDF…" : "Print"}
                  </Button>
                ) : (
                  <div className="w-[4.5rem] shrink-0" />
                )}
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-white hover:bg-white/15"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-2">
            {fromNotification && (
              <div className="mb-2 print-capture-hide">
                <Link
                  href="/notifications"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  ← Return to Notifications
                </Link>
              </div>
            )}

            {initialLoading ? (
              <div className="flex items-center justify-center py-16">
                <ActiniumLoader size="lg" />
              </div>
            ) : !invoice ? (
              <div className="py-12 text-center text-muted-foreground">Invoice not found</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                <Card
                  className={cn(
                    "flex min-h-0 flex-1 flex-col overflow-hidden",
                    "[&>div.relative]:min-h-0 [&>div.relative]:flex-1 [&>div.relative]:overflow-hidden"
                  )}
                >
                  <CardHeader className="shrink-0 border-b bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">INVOICE NUMBER:</Label>
                          <div className="flex items-center gap-1.5">
                            {invoice.invoiceFileUrl ? (
                              <button
                                type="button"
                                onClick={() => void handleViewAttachment(invoice.invoiceFileUrl!)}
                                className="cursor-pointer text-left text-base font-bold text-info underline print-capture-hide"
                              >
                                {invoice.invoiceNumber}
                              </button>
                            ) : (
                              <span className="text-base font-bold">{invoice.invoiceNumber}</span>
                            )}
                            {invoice.invoiceFileUrl ? (
                              <>
                                <span className="hidden text-base font-bold print-capture-static">
                                  {invoice.invoiceNumber}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    void handleDownloadAttachment(
                                      invoice.invoiceFileUrl!,
                                      `invoice-${invoice.invoiceNumber}`
                                    )
                                  }
                                  className="h-6 px-1.5 print-capture-hide"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <BudgetClassificationBadge
                          isBudgeted={budgetClassification}
                          size="sm"
                        />
                      </div>
                      {canReturn() && (
                        <Button
                          onClick={() => setShowReturnDialog(true)}
                          className="h-8 bg-info px-2 text-xs text-white hover:bg-info print-capture-hide"
                        >
                          REFER BACK TO <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <Tabs
                    defaultValue="details"
                    className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
                  >
                    {canViewHistory ? (
                      <div className="shrink-0 border-b bg-muted/30 px-3 py-1.5 print-capture-hide">
                        <TabsList className="h-8 w-full justify-start">
                          <TabsTrigger value="details" className="text-xs">
                            Invoice Details
                          </TabsTrigger>
                          <TabsTrigger value="history" className="text-xs">
                            History
                          </TabsTrigger>
                        </TabsList>
                      </div>
                    ) : null}

                    <TabsContent
                      value="details"
                      className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
                    >
                    <p className="mb-2 rounded border-l-2 border-info bg-info/10 px-2 py-1 text-xs text-info print-capture-hide">
                      Please review supplier name, invoice number, amount, currency and date.
                    </p>

                    <div className="mb-2 grid grid-cols-1 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
                      <div className="space-y-2">
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Invoice Date:
                          </Label>
                          <div className="font-medium">{formatDate(invoice.invoiceDate)}</div>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Invoice Received:
                          </Label>
                          <div className="font-medium">{invoiceReceivedDate}</div>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Payment Due:
                          </Label>
                          <div className="font-medium">{paymentDueDate}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Urgent Payment:
                          </Label>
                          <Badge
                            className={
                              urgentPayment
                                ? "bg-destructive text-white"
                                : "bg-card text-foreground"
                            }
                          >
                            {urgentPayment ? "YES" : "NO"}
                          </Badge>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Budget Classification:
                          </Label>
                          <BudgetClassificationBadge
                            isBudgeted={budgetClassification}
                            size="sm"
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Supplier:
                          </Label>
                          <div className="font-medium">{invoice.vendor?.name || "N/A"}</div>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Vessel/Office:
                          </Label>
                          <div className="font-medium">
                            {invoice.requisition?.vessel?.name || "N/A"}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="mb-1 block text-xs text-muted-foreground">
                            Amount Distribution:
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            {invoice.accountCode ? (
                              <span className="text-sm">
                                {invoice.accountCode.accountCode} - {invoice.accountCode.accountName}
                              </span>
                            ) : invoice.accountType ? (
                              <span className="text-sm">{invoice.accountType}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">N/A</span>
                            )}
                            <Input
                              type="text"
                              value={amountDistributionValue}
                              onChange={(e) => {
                                if (invoice.accountCode) {
                                  setAmountDistribution({
                                    ...amountDistribution,
                                    [invoice.accountCode.accountCode]: e.target.value,
                                  });
                                }
                              }}
                              className="w-full min-w-[120px] max-w-[150px] print-capture-hide"
                            />
                            <span className="hidden text-sm font-medium print-capture-static">
                              {amountDistributionValue}
                            </span>
                          </div>
                        </div>
                        {renderAttachmentLinks(
                          "Attached Invoice",
                          invoice.invoiceFileUrl,
                          `invoice-${invoice.invoiceNumber}`
                        )}
                        {renderAttachmentLinks(
                          "Owner's Approval",
                          invoice.ownerApprovalFileUrl,
                          invoice.ownerApprovalFileName
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <Label className="mb-1 block text-xs font-semibold">Financial Summary</Label>
                      <div className="overflow-hidden rounded border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-2 py-1 text-left text-[10px] font-medium text-foreground">
                                Description
                              </th>
                              <th className="px-2 py-1 text-right text-[10px] font-medium text-foreground">
                                Amount ({displayAmounts?.originalCurrency})
                              </th>
                              <th className="px-2 py-1 text-right text-[10px] font-medium text-foreground">
                                Amount (USD)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t bg-amber-50/90">
                              <td className="px-2 py-1.5 font-semibold">
                                Invoice Amount
                                {fxRateLabel ? (
                                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                                    {fxRateLabel}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold">
                                {formatCurrency(
                                  invoiceAmountOriginal,
                                  displayAmounts?.originalCurrency || invoice.currency
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold">
                                {formatCurrency(invoiceAmountUsd, "USD")}
                              </td>
                            </tr>
                            <tr className="border-t bg-amber-50/90">
                              <td className="px-2 py-1.5 font-semibold">
                                Amount as per vessel approved received QTY
                                {invoice.hasVesselReceipt === false ? (
                                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                                    Vessel receipt not confirmed yet
                                  </span>
                                ) : poCurrency !==
                                  (displayAmounts?.originalCurrency || invoice.currency).toUpperCase() ? (
                                  <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                                    PO currency: {poCurrency}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold">
                                {vesselConfirmedOriginal != null ? (
                                  formatCurrency(vesselConfirmedOriginal, poCurrency)
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold">
                                {vesselConfirmedUsd != null ? (
                                  formatCurrency(vesselConfirmedUsd, "USD")
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-t bg-info text-white">
                              <td className="px-2 py-1.5 font-bold">Amount to be paid</td>
                              <td className="px-2 py-1.5 text-right font-bold">
                                {formatCurrency(
                                  invoiceAmountOriginal,
                                  displayAmounts?.originalCurrency || invoice.currency
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-bold">
                                {formatCurrency(invoiceAmountUsd, "USD")}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {invoice.requisition?.vessel?.company && (
                      <div className="mb-2 rounded bg-muted px-2 py-1 text-xs">
                        <span className="text-muted-foreground">Billing: </span>
                        <span className="font-medium">{invoice.requisition.vessel.company.name}</span>
                        {invoice.requisition.vessel.company.address ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {invoice.requisition.vessel.company.address}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {(mode === "approve" || canApprove()) && (
                      <div className="mb-2 print-capture-hide">
                        <Label htmlFor="remarks" className="mb-1 block text-xs font-semibold">
                          Invoice Verification Remarks:
                        </Label>
                        <Textarea
                          id="remarks"
                          placeholder="Add any remarks or notes about this verification..."
                          value={verificationRemarks}
                          onChange={(e) => setVerificationRemarks(e.target.value)}
                          rows={2}
                          className="w-full text-sm"
                        />
                      </div>
                    )}

                    {verificationRemarks.trim() ? (
                      <div className="mb-2 hidden print-capture-static">
                        <p className="mb-1 text-xs font-semibold">Invoice Verification Remarks</p>
                        <p className="whitespace-pre-wrap rounded border bg-muted/30 px-2 py-1 text-sm">
                          {verificationRemarks}
                        </p>
                      </div>
                    ) : null}

                    {canApprove() && (
                      <div className="flex gap-2 print-capture-hide">
                        <Button
                          onClick={() => void handleVerify()}
                          disabled={loading}
                          className="h-8 bg-info hover:bg-info"
                          size="sm"
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Verify Invoice
                        </Button>
                      </div>
                    )}
                    </TabsContent>

                    {canViewHistory ? (
                      <TabsContent
                        value="history"
                        className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
                      >
                        <p className="mb-2 text-[10px] text-muted-foreground">
                          Created, approvals, returns, and payment events
                        </p>
                        {invoiceHistoryLoading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading history…
                          </div>
                        ) : (
                          <PurchaseEntityHistoryPanel
                            history={invoiceHistory}
                            dense
                            defaultPageSize={8}
                          />
                        )}
                      </TabsContent>
                    ) : null}
                  </Tabs>
                </Card>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Invoice for Reconsideration</DialogTitle>
            <DialogDescription>
              Provide remarks explaining why this invoice is being returned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="returnRemarks">Return Remarks *</Label>
              <Textarea
                id="returnRemarks"
                placeholder="Explain why this invoice needs to be reconsidered..."
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="returnToSelect">Return To (Optional)</Label>
              <Select value={returnTo} onValueChange={setReturnTo}>
                <SelectTrigger id="returnToSelect" className="mt-2">
                  <SelectValue placeholder="Select who to return to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="level1">Level 1 Approver</SelectItem>
                  <SelectItem value="level2">Level 2 Approver</SelectItem>
                  <SelectItem value="level3">Level 3 Approver</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleReturn()}
              disabled={loading || !returnRemarks.trim()}
              className="bg-destructive hover:bg-destructive"
            >
              {loading ? "Returning..." : "Return Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}