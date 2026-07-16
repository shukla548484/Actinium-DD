import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import { requirePurchaseBudgetView } from "@/lib/purchase-budget-access";
import { sendGmailEmail } from "@/lib/gmail-server";
import { findPurchaseBudgetsCompat } from "@/lib/purchase-budget-schema-compat";
import { buildBudgetStats } from "@/lib/purchase-budget-monitor-build";
import {
  buildBudgetVsActualL1Rows,
  buildMonitorStats,
} from "@/lib/purchase-budget-monitor-vs-actual";
import { parsePurchaseBudgetScope } from "@/lib/purchase-budget-scope";
import {
  formatBudgetYearMonthRangeLabel,
  isBudgetRecordInYearMonthRange,
  yearMonthRangeToDateBounds,
} from "@/lib/purchase-budget-year-range";
import { parseBudgetPostingBasis } from "@/lib/purchase-budget-posting-basis";

// Dynamic import for jsPDF to avoid SSR issues
async function getJsPDF() {
  const jsPDFModule = await import("jspdf");
  return jsPDFModule.default || jsPDFModule.jsPDF;
}

// GET /api/purchase/budgets/performance-report - Generate Budget Performance PDF
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const viewDenied = requirePurchaseBudgetView(user.designationAccessLevel);
    if (viewDenied) return viewDenied;

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const year = searchParams.get("year");
    const yearEnd = searchParams.get("yearEnd") ?? year;
    const monthFrom = searchParams.get("monthFrom") ?? searchParams.get("month");
    const monthTo = searchParams.get("monthTo") ?? searchParams.get("month");
    const actualsSource = searchParams.get("actualsSource") === "invoice" ? "invoice" : "po";
    const postingBasis = parseBudgetPostingBasis(searchParams.get("postingBasis"));
    const budgetScope = parsePurchaseBudgetScope(searchParams.get("budgetScope"));

    if (!vesselId || !year || !monthFrom || !monthTo) {
      return NextResponse.json(
        { error: "vesselId, year, monthFrom, and monthTo are required" },
        { status: 400 }
      );
    }

    const rangeFrom = { year: parseInt(year, 10), month: parseInt(monthFrom, 10) };
    const rangeTo = { year: parseInt(yearEnd!, 10), month: parseInt(monthTo, 10) };
    const periodLabel = formatBudgetYearMonthRangeLabel(rangeFrom, rangeTo);

    // Fetch vessel details
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        company: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    let budgets = await findPurchaseBudgetsCompat({
      where: {
        vesselId,
        budgetYear: parseInt(year, 10),
        budgetYearEnd: parseInt(yearEnd!, 10),
        dryDockProjectId: null,
      },
      budgetScope,
    });
    budgets = budgets.filter((b) => isBudgetRecordInYearMonthRange(b, rangeFrom, rangeTo));

    const { startDate, endDate } = yearMonthRangeToDateBounds(rangeFrom, rangeTo);
    const l2Stats = await buildBudgetStats({
      budgets,
      startDate,
      endDate,
      actualsSource,
      postingBasis,
      hasRowFilters: false,
      machineryFilterIds: [],
    });
    const stats = buildMonitorStats(l2Stats, l2Stats.find((b) => b.currency)?.currency ?? "USD");
    const l1Rows = buildBudgetVsActualL1Rows(l2Stats);

    const budgetStats = l2Stats.map((b) => ({
      budgetType: b.budgetType?.name ?? b.section,
      code: b.budgetType?.code ?? "",
      allocated: b.allocatedAmount,
      committed: b.committedAmount,
      spent: b.spentAmount,
      remaining: b.remainingAmount,
      percentage: b.percentageUsed,
      currency: b.currency,
    }));

    const totalAllocated = stats.allocatedBudget;
    const totalSpent = stats.spentBudget;
    const totalCommitted = stats.committedBudget;
    const totalRemaining = stats.remainingBudget;
    const overallPercentage = stats.utilizationPercentage;

    // Generate PDF
    const jsPDF = await getJsPDF();
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const leftMargin = 15;
    const rightMargin = 15;
    const topMargin = 20;
    let yPosition = topMargin;

    // Header
    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, pageWidth, 30, "F");
    
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("ACTINIUM-SM", pageWidth / 2, 12, { align: "center" });
    
    pdf.setFontSize(12);
    pdf.text("SHIP MANAGER SYSTEM", pageWidth / 2, 18, { align: "center" });
    
    pdf.setFontSize(18);
    pdf.text("BUDGET PERFORMANCE REPORT", pageWidth / 2, 25, { align: "center" });

    yPosition = 40;

    // Vessel Information
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text("Vessel Information", leftMargin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Vessel Name: ${vessel.name}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`Vessel Code: ${vessel.code || "N/A"}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`IMO Number: ${vessel.imoNumber || "N/A"}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`Company: ${vessel.company?.name || "N/A"}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`Period: ${periodLabel}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`Actuals basis: ${actualsSource === "invoice" ? "Invoices" : "Purchase orders"}`, leftMargin, yPosition);
    yPosition += 6;
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, leftMargin, yPosition);
    yPosition += 10;

    // Summary Statistics
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Summary Statistics", leftMargin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const summaryData = [
      ["Total Allocated", formatCurrency(totalAllocated, stats.currency)],
      ["Total Committed", formatCurrency(totalCommitted, stats.currency)],
      ["Total Actual", formatCurrency(totalSpent, stats.currency)],
      ["Total Remaining", formatCurrency(totalRemaining, stats.currency)],
      ["Utilization", `${overallPercentage.toFixed(1)}%`],
    ];

    summaryData.forEach(([label, value]) => {
      pdf.text(`${label}:`, leftMargin, yPosition);
      pdf.setFont("helvetica", "bold");
      pdf.text(value, leftMargin + 60, yPosition);
      pdf.setFont("helvetica", "normal");
      yPosition += 6;
    });

    yPosition += 5;

    // Budget Details Table
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = topMargin;
    }

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Budget vs Actual by L1 Category", leftMargin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(240, 240, 240);
    pdf.rect(leftMargin, yPosition - 5, pageWidth - leftMargin - rightMargin, 8, "F");
    pdf.text("L1 Category", leftMargin + 2, yPosition);
    pdf.text("Budget", leftMargin + 55, yPosition);
    pdf.text("Actual", leftMargin + 80, yPosition);
    pdf.text("Committed", leftMargin + 105, yPosition);
    pdf.text("Variance", leftMargin + 135, yPosition);
    yPosition += 8;

    pdf.setFont("helvetica", "normal");
    l1Rows.forEach((row) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = topMargin;
      }
      pdf.setFontSize(8);
      pdf.text(row.label.substring(0, 28), leftMargin + 2, yPosition);
      pdf.text(formatCurrency(row.budget, stats.currency), leftMargin + 55, yPosition);
      pdf.text(formatCurrency(row.actual, stats.currency), leftMargin + 80, yPosition);
      pdf.text(formatCurrency(row.committed, stats.currency), leftMargin + 105, yPosition);
      pdf.setTextColor(row.variance < 0 ? 255 : 0, row.variance < 0 ? 0 : 128, 0);
      pdf.text(formatCurrency(row.variance, stats.currency), leftMargin + 135, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 6;
    });

    yPosition += 6;
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = topMargin;
    }
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Detail by L2 Budget Code", leftMargin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(240, 240, 240);
    pdf.rect(leftMargin, yPosition - 5, pageWidth - leftMargin - rightMargin, 8, "F");
    pdf.text("Budget Type", leftMargin + 2, yPosition);
    pdf.text("Allocated", leftMargin + 70, yPosition);
    pdf.text("Actual", leftMargin + 95, yPosition);
    pdf.text("Remaining", leftMargin + 120, yPosition);
    pdf.text("Usage %", leftMargin + 155, yPosition);
    yPosition += 8;

    pdf.setFont("helvetica", "normal");
    budgetStats.forEach((stat) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = topMargin;
      }
      pdf.setFontSize(8);
      pdf.text(stat.budgetType.substring(0, 25), leftMargin + 2, yPosition);
      pdf.text(formatCurrency(stat.allocated, stat.currency), leftMargin + 70, yPosition);
      pdf.text(formatCurrency(stat.spent, stat.currency), leftMargin + 95, yPosition);
      pdf.text(formatCurrency(stat.remaining, stat.currency), leftMargin + 120, yPosition);
      if (stat.percentage >= 100) {
        pdf.setTextColor(255, 0, 0);
      } else if (stat.percentage >= 80) {
        pdf.setTextColor(255, 165, 0);
      } else {
        pdf.setTextColor(0, 128, 0);
      }
      pdf.text(`${stat.percentage.toFixed(1)}%`, leftMargin + 155, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 6;
    });

    // Footer
    const finalY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Generated by ${user.firstName} ${user.lastName} on ${new Date().toLocaleString()}`,
      pageWidth / 2,
      finalY,
      { align: "center" }
    );

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Budget_Performance_${vessel.code}_${periodLabel.replace(/\s+/g, "_")}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating budget performance report:", error);
    return NextResponse.json(
      { error: "Failed to generate report", details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/purchase/budgets/performance-report - Generate and send PDF via email
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const viewDenied = requirePurchaseBudgetView(user.designationAccessLevel);
    if (viewDenied) return viewDenied;

    const body = await request.json();
    const {
      vesselId,
      year,
      yearEnd,
      month,
      monthFrom,
      monthTo,
      actualsSource,
      postingBasis,
      budgetScope,
      recipientEmail,
      subject,
      message,
    } = body;

    const fromMonth = monthFrom ?? month;
    const toMonth = monthTo ?? month;

    if (!vesselId || !year || !fromMonth || !toMonth || !recipientEmail) {
      return NextResponse.json(
        { error: "vesselId, year, monthFrom/monthTo, and recipientEmail are required" },
        { status: 400 }
      );
    }

    const reportUrl = new URL("/api/purchase/budgets/performance-report", request.url);
    reportUrl.searchParams.set("vesselId", vesselId);
    reportUrl.searchParams.set("year", String(year));
    reportUrl.searchParams.set("yearEnd", String(yearEnd ?? year));
    reportUrl.searchParams.set("monthFrom", String(fromMonth));
    reportUrl.searchParams.set("monthTo", String(toMonth));
    if (actualsSource) reportUrl.searchParams.set("actualsSource", actualsSource);
    if (postingBasis) reportUrl.searchParams.set("postingBasis", postingBasis);
    if (budgetScope) reportUrl.searchParams.set("budgetScope", budgetScope);

    const pdfResponse = await fetch(reportUrl.toString(), {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error("Failed to generate PDF");
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Fetch vessel for email content
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    const periodSlug = `${year}-${String(fromMonth).padStart(2, "0")}_to_${yearEnd ?? year}-${String(toMonth).padStart(2, "0")}`;
    const emailSubject =
      subject || `Budget Performance Report - ${vessel?.name || "Vessel"} - ${periodSlug}`;
    const emailMessage =
      message ||
      `Please find attached the Budget & Actual report for ${vessel?.name || "the vessel"} (${periodSlug}).`;

    // Send email with PDF attachment
    await sendGmailEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: `
        <html>
          <body>
            <p>${emailMessage}</p>
            <p>This report was generated by ${user.firstName} ${user.lastName}.</p>
            <p>Best regards,<br>Actinium Ship Management System</p>
          </body>
        </html>
      `,
      text: `${emailMessage}\n\nThis report was generated by ${user.firstName} ${user.lastName}.\n\nBest regards,\nActinium Ship Management System`,
      attachments: [
        {
          filename: `Budget_Performance_${vessel?.code || "vessel"}_${periodSlug}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: "Budget performance report sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending budget performance report:", error);
    return NextResponse.json(
      { error: "Failed to send report", details: error.message },
      { status: 500 }
    );
  }
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
