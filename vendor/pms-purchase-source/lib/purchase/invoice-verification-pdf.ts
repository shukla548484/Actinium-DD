import type { PurchaseEntityHistoryEntry } from "@/lib/purchase/build-entity-history";
import type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";
import { REQUISITION_STATUS_LABELS } from "@/lib/types/requisition";
import { budgetClassificationLabel } from "@/lib/purchase/po-budget-classification";

export type InvoiceVerificationPdfInput = {
  documentTitle: string;
  invoiceNumber: string;
  vesselName?: string;
  poNumber?: string;
  workflowSteps: PurchaseWorkflowStep[];
  invoiceDate: string;
  invoiceReceivedDate: string;
  paymentDueDate: string;
  urgentPayment: boolean;
  supplierName?: string;
  amountDistribution?: string;
  accountLabel?: string;
  attachedInvoiceName?: string;
  ownerApprovalName?: string;
  invoiceAmountOriginal: number;
  invoiceAmountUsd: number;
  originalCurrency: string;
  vesselConfirmedOriginal: number | null;
  vesselConfirmedUsd: number | null;
  poCurrency: string;
  hasVesselReceipt?: boolean;
  budgetClassification?: boolean | null;
  fxRateLabel?: string | null;
  billingCompany?: string;
  billingAddress?: string;
  verificationRemarks?: string;
  history?: PurchaseEntityHistoryEntry[];
  generatedAt?: Date;
};

type JsPdfWithAutoTable = import("jspdf").jsPDF & {
  lastAutoTable: { finalY: number };
};

function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function workflowStatusLabel(step: PurchaseWorkflowStep): string {
  switch (step.status) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "not_required":
      return "N/A";
    case "waiting":
      return "Waiting";
    default:
      return "Pending";
  }
}

function workflowDetail(step: PurchaseWorkflowStep): string {
  if (step.approvedAt) {
    const when = new Date(step.approvedAt).toLocaleString();
    return step.approverName ? `${step.approverName} · ${when}` : when;
  }
  if (step.approverName) return step.approverName;
  return workflowStatusLabel(step);
}

function historyStatusLabel(entry: PurchaseEntityHistoryEntry): string {
  const labels = REQUISITION_STATUS_LABELS as Record<string, string>;
  const fmt = (s: string | null | undefined) =>
    s ? labels[s] ?? s.replace(/_/g, " ") : "—";
  if (entry.previousStatus && entry.newStatus) {
    return `${fmt(entry.previousStatus)} → ${fmt(entry.newStatus)}`;
  }
  return fmt(entry.newStatus);
}

function historyDetails(entry: PurchaseEntityHistoryEntry): string {
  return [entry.actionDescription, entry.comments].filter(Boolean).join(" — ") || "—";
}

export async function generateInvoiceVerificationPdf(
  input: InvoiceVerificationPdfInput
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as JsPdfWithAutoTable;
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 14;

  const sectionTitle = (title: string) => {
    const pageH = pdf.internal.pageSize.getHeight();
    if (y + 12 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFillColor(245, 158, 11);
    pdf.rect(margin, y, contentW, 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, margin + 2, y + 5);
    pdf.setTextColor(0, 0, 0);
    y += 10;
  };

  pdf.setFillColor(245, 158, 11);
  pdf.rect(0, 0, pageW, 24, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(input.documentTitle, margin, 11);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Invoice ${input.invoiceNumber}`, margin, 18);
  const metaRight: string[] = [];
  if (input.vesselName) metaRight.push(input.vesselName);
  if (input.poNumber) metaRight.push(`PO ${input.poNumber}`);
  if (metaRight.length) {
    pdf.text(metaRight.join(" · "), margin, 22);
  }
  const generatedLabel = `Generated ${(input.generatedAt ?? new Date()).toLocaleString()}`;
  pdf.text(generatedLabel, pageW - margin, 11, { align: "right" });
  y = 30;
  pdf.setTextColor(0, 0, 0);

  sectionTitle("Invoice Approval Matrix");
  autoTable(pdf, {
    startY: y,
    head: [["Step", "Status", "Approver / date"]],
    body: input.workflowSteps.map((step) => [
      step.title,
      workflowStatusLabel(step),
      workflowDetail(step),
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [82, 82, 82], textColor: 255 },
    theme: "striped",
  });
  y = pdf.lastAutoTable.finalY + 6;

  sectionTitle("Invoice Details");
  const accountLine = [input.accountLabel, input.amountDistribution].filter(Boolean).join(" — ");
  autoTable(pdf, {
    startY: y,
    body: [
      ["Invoice Date", input.invoiceDate],
      ["Invoice Received", input.invoiceReceivedDate],
      ["Payment Due", input.paymentDueDate],
      ["Urgent Payment", input.urgentPayment ? "YES" : "NO"],
      [
        "Budget Classification",
        budgetClassificationLabel(input.budgetClassification),
      ],
      ["Supplier", input.supplierName || "N/A"],
      ["Vessel / Office", input.vesselName || "N/A"],
      ["PO Number", input.poNumber || "N/A"],
      ["Amount Distribution", accountLine || "N/A"],
      ["Attached Invoice", input.attachedInvoiceName || "Not attached"],
      ["Owner's Approval", input.ownerApprovalName || "Not attached"],
    ],
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", fillColor: [250, 250, 250] },
      1: { cellWidth: contentW - 52 },
    },
  });
  y = pdf.lastAutoTable.finalY + 6;

  sectionTitle("Financial Summary");
  const vesselNote =
    input.hasVesselReceipt === false ? "\nVessel receipt not confirmed yet" : "";
  const invoiceDesc = input.fxRateLabel
    ? `Invoice Amount\n${input.fxRateLabel}`
    : "Invoice Amount";
  const vesselDesc = `Amount as per vessel approved received QTY${vesselNote}`;

  autoTable(pdf, {
    startY: y,
    head: [["Description", `Amount (${input.originalCurrency})`, "Amount (USD)"]],
    body: [
      [
        invoiceDesc,
        formatMoney(input.invoiceAmountOriginal, input.originalCurrency),
        formatMoney(input.invoiceAmountUsd, "USD"),
      ],
      [
        vesselDesc,
        formatMoney(input.vesselConfirmedOriginal, input.poCurrency),
        formatMoney(input.vesselConfirmedUsd, "USD"),
      ],
      [
        "Amount to be paid",
        formatMoney(input.invoiceAmountOriginal, input.originalCurrency),
        formatMoney(input.invoiceAmountUsd, "USD"),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [82, 82, 82], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [245, 158, 11];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      } else if (data.row.index < 2) {
        data.cell.styles.fillColor = [255, 251, 235];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = pdf.lastAutoTable.finalY + 6;

  if (input.billingCompany) {
    const pageH = pdf.internal.pageSize.getHeight();
    if (y + 12 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("Billing:", margin, y);
    pdf.setFont("helvetica", "normal");
    const billingText = [input.billingCompany, input.billingAddress].filter(Boolean).join(" · ");
    const billingLines = pdf.splitTextToSize(billingText, contentW - 16);
    pdf.text(billingLines, margin + 16, y);
    y += billingLines.length * 4 + 6;
  }

  if (input.verificationRemarks?.trim()) {
    sectionTitle("Invoice Verification Remarks");
    const remarkLines = pdf.splitTextToSize(input.verificationRemarks.trim(), contentW);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(remarkLines, margin, y);
    y += remarkLines.length * 4 + 4;
  }

  if (input.history && input.history.length > 0) {
    sectionTitle("History");
    autoTable(pdf, {
      startY: y,
      head: [["Event", "Status change", "User", "Date & time", "Details"]],
      body: input.history.map((entry) => [
        entry.actionLabel,
        historyStatusLabel(entry),
        [entry.performedBy.firstName, entry.performedBy.lastName]
          .filter(Boolean)
          .join(" ") || "System",
        new Date(entry.createdAt).toLocaleString(),
        historyDetails(entry),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [82, 82, 82], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: contentW - 118 },
      },
    });
  }

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `Invoice Verification · ${input.invoiceNumber} · Page ${i} of ${pageCount}`,
      pageW / 2,
      pdf.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  return pdf.output("arraybuffer");
}

export async function downloadInvoiceVerificationPdf(
  input: InvoiceVerificationPdfInput,
  filename: string,
  appendPdfBuffers?: ArrayBuffer[]
): Promise<void> {
  let pdfBytes = await generateInvoiceVerificationPdf(input);

  if (appendPdfBuffers?.length) {
    const { PDFDocument } = await import("pdf-lib");
    const mergedPdf = await PDFDocument.load(pdfBytes);
    for (const buffer of appendPdfBuffers) {
      try {
        const attachmentPdf = await PDFDocument.load(buffer);
        const indices = Array.from({ length: attachmentPdf.getPageCount() }, (_, i) => i);
        const copied = await mergedPdf.copyPages(attachmentPdf, indices);
        copied.forEach((page) => mergedPdf.addPage(page));
      } catch {
        // skip invalid attachment PDFs
      }
    }
    pdfBytes = await mergedPdf.save();
  }

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
