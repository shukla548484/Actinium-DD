import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { QuoteStatus } from "@/lib/types/vendor";

// GET /api/quotes/stats - Get quote statistics for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const vendorId = searchParams.get("vendorId");
    
    // Build date filter
    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      dateFilter.sentAt = {};
      if (dateFrom) {
        dateFilter.sentAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.sentAt.lte = new Date(dateTo);
      }
    }

    // Build base where clause
    const baseWhere: any = {
      ...dateFilter,
    };

    if (vendorId) {
      baseWhere.vendorId = vendorId;
    }

    // Get overall stats
    const [
      totalQuotes,
      sentQuotes,
      receivedQuotes,
      expiredQuotes,
      recentQuotes,
    ] = await Promise.all([
      // Total quotes
      prisma.vendorQuote.count({
        where: baseWhere,
      }),

      // Sent quotes (pending response)
      prisma.vendorQuote.count({
        where: {
          ...baseWhere,
          status: QuoteStatus.SENT,
        },
      }),

      // Received quotes
      prisma.vendorQuote.count({
        where: {
          ...baseWhere,
          status: QuoteStatus.RECEIVED,
        },
      }),

      // Expired quotes (sent but past valid until date)
      prisma.vendorQuote.count({
        where: {
          ...baseWhere,
          status: QuoteStatus.SENT,
          validUntil: {
            lt: new Date(),
          },
        },
      }),

      // Recent quotes (last 7 days)
      prisma.vendorQuote.findMany({
        where: {
          ...baseWhere,
          sentAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            ...dateFilter.sentAt,
          },
        },
        orderBy: { sentAt: "desc" },
        take: 10,
        include: {
          vendor: {
            select: {
              name: true,
            },
          },
          requisition: {
            select: {
              requisitionNumber: true,
              heading: true,
            },
          },
        },
      }),
    ]);

    // Get quote response rate (received / sent)
    const responseRate = sentQuotes + receivedQuotes > 0 
      ? ((receivedQuotes / (sentQuotes + receivedQuotes)) * 100).toFixed(1)
      : "0";

    // Get quotes by vendor (top 10)
    const quotesByVendor = await prisma.vendorQuote.groupBy({
      by: ['vendorId'],
      where: baseWhere,
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Get vendor details for the grouped data
    const vendorDetails = await prisma.vendor.findMany({
      where: {
        id: {
          in: quotesByVendor.map(q => q.vendorId),
        },
      },
      select: {
        id: true,
        name: true,
        country: true,
      },
    });

    const quotesByVendorWithDetails = quotesByVendor.map(stat => {
      const vendor = vendorDetails.find(v => v.id === stat.vendorId);
      return {
        vendor,
        quoteCount: stat._count.id,
      };
    });

    // Get quotes by status for chart
    const quotesByStatus = await prisma.vendorQuote.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: {
        id: true,
      },
    });

    // Get quotes by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const quotesByMonth = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "sentAt") as month,
        COUNT(*) as count,
        SUM(CASE WHEN status = ${QuoteStatus.RECEIVED} THEN 1 ELSE 0 END) as received_count
      FROM "VendorQuote"
      WHERE "sentAt" >= ${sixMonthsAgo}
        ${vendorId ? prisma.$queryRaw`AND "vendorId" = ${vendorId}` : prisma.$queryRaw``}
        ${dateFrom ? prisma.$queryRaw`AND "sentAt" >= ${new Date(dateFrom)}` : prisma.$queryRaw``}
        ${dateTo ? prisma.$queryRaw`AND "sentAt" <= ${new Date(dateTo)}` : prisma.$queryRaw``}
      GROUP BY DATE_TRUNC('month', "sentAt")
      ORDER BY month ASC
    `;

    // Calculate average response time (for received quotes)
    const responseTimeQuery = await prisma.vendorQuote.findMany({
      where: {
        ...baseWhere,
        status: QuoteStatus.RECEIVED,
        receivedAt: {
          not: null,
        },
      },
      select: {
        sentAt: true,
        receivedAt: true,
      },
    });

    const responseTimes = responseTimeQuery.map(quote => {
      if (quote.receivedAt && quote.sentAt) {
        return Math.abs(quote.receivedAt.getTime() - quote.sentAt.getTime()) / (1000 * 60 * 60 * 24); // days
      }
      return 0;
    }).filter(time => time > 0);

    const averageResponseTime = responseTimes.length > 0
      ? (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length).toFixed(1)
      : "0";

    return NextResponse.json({
      overview: {
        totalQuotes,
        sentQuotes,
        receivedQuotes,
        expiredQuotes,
        responseRate: parseFloat(responseRate),
        averageResponseTime: parseFloat(averageResponseTime),
      },
      charts: {
        byStatus: quotesByStatus.map(stat => ({
          status: stat.status,
          count: stat._count.id,
        })),
        byVendor: quotesByVendorWithDetails,
        byMonth: quotesByMonth,
      },
      recentActivity: recentQuotes.map(quote => ({
        id: quote.id,
        vendor: quote.vendor.name,
        requisition: {
          number: quote.requisition.requisitionNumber,
          heading: quote.requisition.heading,
        },
        status: quote.status,
        sentAt: quote.sentAt,
        validUntil: quote.validUntil,
        isExpired: quote.validUntil ? new Date() > quote.validUntil : false,
      })),
    });
  } catch (error) {
    console.error("Error fetching quote statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote statistics" },
      { status: 500 }
    );
  }
}