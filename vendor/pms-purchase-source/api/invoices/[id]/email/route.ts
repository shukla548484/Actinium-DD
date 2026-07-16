import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/session";
import {
  buildInvoiceEmailCc,
  isInvoiceResendConfigured,
  sendInvoiceEmail,
} from "@/lib/invoice-email-resend";

const bodySchema = z.object({
  recipientType: z.enum(["supplier", "vessel"]),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(20000),
  additionalCc: z.array(z.string().email()).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!currentUser.email?.trim()) {
      return NextResponse.json(
        { error: "Your account must have an email address to send invoice emails." },
        { status: 400 }
      );
    }
    if (!isInvoiceResendConfigured()) {
      return NextResponse.json(
        { error: "Invoice email is not configured (RESEND_API_KEY missing)." },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            name: true,
            primaryEmail: true,
            secondaryEmail: true,
          },
        },
        purchaseOrder: { select: { poNumber: true } },
        requisition: {
          select: {
            requisitionNumber: true,
            vessel: {
              select: {
                id: true,
                name: true,
                code: true,
                company: { select: { email: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { recipientType, subject, body, additionalCc } = parsed.data;
    let to: string | null = null;

    if (recipientType === "supplier") {
      to = invoice.vendor?.primaryEmail?.trim() || null;
      if (!to) {
        return NextResponse.json(
          { error: "Supplier has no primary email on file." },
          { status: 400 }
        );
      }
    } else {
      const vessel = invoice.requisition?.vessel;
      const recipient = await prisma.noon_report_email_recipients.findFirst({
        where: {
          vessel_id: vessel?.id,
          is_active: true,
        },
        select: { email: true },
        orderBy: { created_at: "asc" },
      });
      to =
        recipient?.email?.trim() ||
        vessel?.company?.email?.trim() ||
        null;
      if (!to) {
        return NextResponse.json(
          {
            error:
              "No vessel email found. Add a noon-report email recipient or company email for this vessel.",
          },
          { status: 400 }
        );
      }
    }

    const vesselLabel = invoice.requisition?.vessel
      ? `${invoice.requisition.vessel.name} (${invoice.requisition.vessel.code})`
      : "Vessel";
    const poNumber = invoice.purchaseOrder?.poNumber ?? "—";

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">
        ${body
          .split("\n")
          .map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line) || "&nbsp;"}</p>`)
          .join("")}
        <p style="margin:16px 0 0;font-size:13px;color:#374151;">
          <strong>Invoice:</strong> ${escapeHtml(invoice.invoiceNumber)}<br/>
          <strong>PO:</strong> ${escapeHtml(poNumber)}<br/>
          <strong>Vessel:</strong> ${escapeHtml(vesselLabel)}
        </p>
      </div>
    `.trim();

    const cc = buildInvoiceEmailCc(
      currentUser.email,
      [
        ...(additionalCc ?? []),
        ...(recipientType === "supplier" && invoice.vendor?.secondaryEmail
          ? [invoice.vendor.secondaryEmail]
          : []),
      ]
    );

    const result = await sendInvoiceEmail({
      to,
      cc,
      subject,
      html: htmlBody,
      text: body,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      to,
      cc,
    });
  } catch (error) {
    console.error("[INVOICE EMAIL]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send invoice email",
      },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
