import { NextRequest, NextResponse } from "next/server";
import { detectAndProcessQuoteResponses } from "@/lib/quote-email-detector";
import { getCurrentUserFromRequest } from "@/lib/session";
import { processAllUnprocessedQuotes } from "@/lib/services/auto-quote-processor";
import {
  getQuoteEmailMonitorSnapshot,
  repairStuckQuoteEmailRecords,
} from "@/lib/emails/quote-email-discovery";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/**
 * POST /api/quotes/process-responses
 * Manually trigger processing of quote response emails
 * This will:
 * 1. Find unprocessed emails with Excel attachments
 * 2. Match them by requisition number, IMO number, email ID, and vendor email
 * 3. Parse Excel files and store data in database
 * 4. Upload Excel files to Google Cloud Storage with proper identification
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin access (access level 50) or procurement access (32, 33)
    const accessLevel = currentUser.designationAccessLevel;
    if (!isAdminEquivalentAccessLevel(accessLevel) && accessLevel !== 32 && accessLevel !== 33) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin or procurement access required." },
        { status: 403 }
      );
    }

    console.log("🔄 Processing quote response emails...");

    const repair = await repairStuckQuoteEmailRecords();
    if (repair.repaired > 0) {
      console.log(`🔧 Reset processed flag on ${repair.repaired} stuck quote email(s)`);
    }

    const autoResult = await processAllUnprocessedQuotes();
    console.log(`✅ Auto-processed ${autoResult.processed} quote email(s), skipped ${autoResult.skipped}, failed ${autoResult.failed}`);

    const legacyResult = await detectAndProcessQuoteResponses();
    console.log(`✅ Legacy detector processed ${legacyResult.processed || 0} quote(s) from ${legacyResult.emailsChecked || 0} email(s)`);

    const processed = autoResult.processed + (legacyResult.processed || 0);
    const emailsChecked = legacyResult.emailsChecked || 0;
    const snapshot = await getQuoteEmailMonitorSnapshot();

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} quote(s) (auto: ${autoResult.processed}, legacy: ${legacyResult.processed || 0}) from ${emailsChecked} email(s)`,
      processed,
      autoProcessed: autoResult.processed,
      autoFailed: autoResult.failed,
      autoSkipped: autoResult.skipped,
      repair,
      legacyProcessed: legacyResult.processed || 0,
      emailsChecked,
      monitor: snapshot,
    });
  } catch (error: any) {
    console.error("❌ Error processing quote responses:", error);
    return NextResponse.json(
      {
        error: "Failed to process quote responses",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quotes/process-responses
 * Get status of quote response processing
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { prisma } = await import("@/lib/prisma");
    const snapshot = await getQuoteEmailMonitorSnapshot();

    const quotesWithResponses = await prisma.vendorQuote.count({
      where: {
        status: "RECEIVED",
      },
    });

    const quotesWithNoItems = await prisma.vendorQuote.count({
      where: {
        quotedItems: {
          none: {},
        },
      },
    });

    return NextResponse.json({
      success: true,
      statistics: {
        ...snapshot.totals,
        quotesWithResponses,
        quotesWithNoItems,
        checkedAt: snapshot.checkedAt,
        pendingSamples: snapshot.pendingSamples,
      },
      lifecycle: {
        RECEIVED: "Stored from Gmail",
        MATCHED: "Linked to quote — import pending",
        IMPORTED: "Complete — will not reprocess",
        FAILED: "Will retry on next cron cycle",
      },
    });
  } catch (error: any) {
    console.error("❌ Error getting quote response status:", error);
    return NextResponse.json(
      {
        error: "Failed to get quote response status",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
