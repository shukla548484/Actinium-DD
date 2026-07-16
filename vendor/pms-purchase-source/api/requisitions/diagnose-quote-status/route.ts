import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { RequisitionStatus } from "@/lib/types/requisition";
import { QuoteStatus } from "@/lib/types/vendor";

/**
 * GET /api/requisitions/diagnose-quote-status
 * Diagnose requisitions that show SENT_FOR_QUOTE but have no SENT vendor quotes
 * 
 * Query params:
 * - fix=true: Actually fix the issues (default: false, just diagnose)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fix = searchParams.get("fix") === "true";

    // Find requisitions with SENT_FOR_QUOTE status
    const requisitions = await prisma.requisition.findMany({
      where: {
        status: RequisitionStatus.SENT_FOR_QUOTE,
      },
      include: {
        vendorQuotes: {
          select: {
            id: true,
            vendorId: true,
            status: true,
            sentAt: true,
            vendor: {
              select: {
                name: true,
                primaryEmail: true,
              },
            },
          },
        },
      },
      orderBy: {
        dateOfCreation: "desc",
      },
    });

    const issues: Array<{
      requisitionId: string;
      requisitionNumber: string;
      heading: string;
      totalQuotes: number;
      sentQuotes: number;
      pendingQuotes: number;
      issue: string;
      fixed?: boolean;
    }> = [];

    for (const req of requisitions) {
      const sentQuotes = req.vendorQuotes.filter((q) => q.status === QuoteStatus.SENT);
      const pendingQuotes = req.vendorQuotes.filter((q) => q.status === QuoteStatus.PENDING);

      // Issue: Requisition shows SENT_FOR_QUOTE but no quotes are actually SENT
      if (sentQuotes.length === 0 && req.vendorQuotes.length > 0) {
        issues.push({
          requisitionId: req.id,
          requisitionNumber: req.requisitionNumber,
          heading: req.heading,
          totalQuotes: req.vendorQuotes.length,
          sentQuotes: 0,
          pendingQuotes: pendingQuotes.length,
          issue: `Requisition shows "Sent for Quote" but ${req.vendorQuotes.length} quote(s) are in PENDING status (no emails were actually sent)`,
        });

        // Fix: Set requisition status back to REQ_APPROVED
        if (fix) {
          await prisma.requisition.update({
            where: { id: req.id },
            data: {
              status: RequisitionStatus.REQ_APPROVED,
            },
          });
          issues[issues.length - 1].fixed = true;
        }
      }
      // Issue: Requisition shows SENT_FOR_QUOTE but has no quotes at all
      else if (req.vendorQuotes.length === 0) {
        issues.push({
          requisitionId: req.id,
          requisitionNumber: req.requisitionNumber,
          heading: req.heading,
          totalQuotes: 0,
          sentQuotes: 0,
          pendingQuotes: 0,
          issue: `Requisition shows "Sent for Quote" but has no vendor quotes associated`,
        });

        // Fix: Set requisition status back to REQ_APPROVED
        if (fix) {
          await prisma.requisition.update({
            where: { id: req.id },
            data: {
              status: RequisitionStatus.REQ_APPROVED,
            },
          });
          issues[issues.length - 1].fixed = true;
        }
      }
    }

    return NextResponse.json({
      summary: {
        totalRequisitionsChecked: requisitions.length,
        issuesFound: issues.length,
        fixed: fix ? issues.filter((i) => i.fixed).length : 0,
      },
      issues,
      message: fix
        ? `Diagnosed ${issues.length} issue(s) and fixed ${issues.filter((i) => i.fixed).length} of them.`
        : `Found ${issues.length} issue(s). Add ?fix=true to the URL to fix them.`,
    });
  } catch (error: any) {
    console.error("Error diagnosing quote status:", error);
    return NextResponse.json(
      {
        error: "Failed to diagnose quote status",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

















