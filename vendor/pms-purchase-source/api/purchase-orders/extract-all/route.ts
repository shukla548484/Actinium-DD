import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/session";
import prisma from "@/lib/prisma";

/**
 * GET /api/purchase-orders/extract-all
 * Extract all purchase orders data for display with pagination
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25)
 */
export async function GET(request: NextRequest) {
  const errorContext: any = {
    step: 'initialization',
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Authenticate user
    errorContext.step = 'authentication';
    let currentUser;
    try {
      currentUser = await getCurrentUserFromRequest(request);
      if (!currentUser) {
        return NextResponse.json(
          { 
            error: "Unauthorized",
            details: "User authentication failed",
            code: "AUTH_REQUIRED"
          },
          { status: 401 }
        );
      }
      errorContext.userId = currentUser.id;
      errorContext.userEmail = currentUser.email;
    } catch (authError: any) {
      console.error("[EXTRACT-ALL] Authentication error:", authError);
      return NextResponse.json(
        {
          error: "Authentication failed",
          details: authError.message || "Failed to authenticate user",
          code: "AUTH_ERROR",
          step: errorContext.step,
        },
        { status: 401 }
      );
    }

    // Step 2: Parse query parameters
    errorContext.step = 'parse_parameters';
    let page: number, limit: number, skip: number;
    try {
      const { searchParams } = new URL(request.url);
      page = parseInt(searchParams.get("page") || "1");
      limit = parseInt(searchParams.get("limit") || "25");
      skip = (page - 1) * limit;
      
      if (isNaN(page) || page < 1) {
        return NextResponse.json(
          {
            error: "Invalid page parameter",
            details: `Page must be a positive integer, got: ${searchParams.get("page")}`,
            code: "INVALID_PAGE",
          },
          { status: 400 }
        );
      }
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return NextResponse.json(
          {
            error: "Invalid limit parameter",
            details: `Limit must be between 1 and 100, got: ${searchParams.get("limit")}`,
            code: "INVALID_LIMIT",
          },
          { status: 400 }
        );
      }
      
      errorContext.pagination = { page, limit, skip };
    } catch (paramError: any) {
      console.error("[EXTRACT-ALL] Parameter parsing error:", paramError);
      return NextResponse.json(
        {
          error: "Invalid request parameters",
          details: paramError.message || "Failed to parse query parameters",
          code: "PARAM_ERROR",
          step: errorContext.step,
        },
        { status: 400 }
      );
    }

    // Step 3: Get user's access level and assigned vessel names
    errorContext.step = 'get_user_access';
    let hasFullAccess: boolean;
    let allowedVesselNames: string[] = [];
    
    try {
      const accessLevel = currentUser.designationAccessLevel || 0;
      hasFullAccess = [50, 99, 100].includes(accessLevel);
      errorContext.accessLevel = accessLevel;
      errorContext.hasFullAccess = hasFullAccess;

      if (!hasFullAccess) {
        try {
          const assignedVessels = await prisma.employeeVessel.findMany({
            where: {
              employeeId: currentUser.id,
            },
            include: {
              vessel: {
                select: {
                  name: true,
                },
              },
            },
          });
          allowedVesselNames = assignedVessels
            .map((av) => av.vessel?.name)
            .filter((name): name is string => !!name);
          errorContext.assignedVesselCount = allowedVesselNames.length;
        } catch (vesselError: any) {
          console.error("[EXTRACT-ALL] Error fetching assigned vessels:", vesselError);
          return NextResponse.json(
            {
              error: "Failed to fetch user vessel assignments",
              details: vesselError.message || "Database query failed",
              code: vesselError.code || "DB_QUERY_ERROR",
              step: errorContext.step,
              prismaCode: vesselError.code,
            },
            { status: 500 }
          );
        }
      }
    } catch (accessError: any) {
      console.error("[EXTRACT-ALL] Access level check error:", accessError);
      return NextResponse.json(
        {
          error: "Failed to determine user access",
          details: accessError.message || "Access level check failed",
          code: "ACCESS_CHECK_ERROR",
          step: errorContext.step,
        },
        { status: 500 }
      );
    }

    // Step 4: Build where clause
    errorContext.step = 'build_query';
    const where: any = {};

    try {
      // Always ensure quote exists (required relationship)
      where.quoteId = { not: null };

      // Apply user access restrictions - if user doesn't have full access, only show their vessels
      if (!hasFullAccess) {
        if (allowedVesselNames.length > 0) {
          // Filter by vessel name directly on purchase_orders table
          where.vesselName = { in: allowedVesselNames };
          errorContext.filterType = 'vessel_restricted';
          errorContext.filteredVesselNames = allowedVesselNames;
        } else {
          // User has no assigned vessels and no full access - return empty result
          return NextResponse.json({
            success: true,
            purchaseOrders: [],
            count: 0,
            page,
            limit,
            totalPages: 0,
            message: "No vessels assigned to user",
          });
        }
      } else {
        // For full access users, ensure requisition exists
        where.requisitionId = { not: null };
        errorContext.filterType = 'all_access';
      }
      
      errorContext.whereClause = JSON.stringify(where);
    } catch (queryBuildError: any) {
      console.error("[EXTRACT-ALL] Query build error:", queryBuildError);
      return NextResponse.json(
        {
          error: "Failed to build database query",
          details: queryBuildError.message || "Query construction failed",
          code: "QUERY_BUILD_ERROR",
          step: errorContext.step,
        },
        { status: 500 }
      );
    }

    // Step 5: Get total count
    errorContext.step = 'count_records';
    let totalCount: number;
    try {
      totalCount = await prisma.purchaseOrder.count({
        where,
      });
      errorContext.totalCount = totalCount;
    } catch (countError: any) {
      console.error("[EXTRACT-ALL] Count query error:", countError);
      console.error("[EXTRACT-ALL] Count error details:", {
        code: countError.code,
        meta: countError.meta,
        message: countError.message,
      });
      
      // Check for specific Prisma errors
      if (countError.code === 'P2021') {
        return NextResponse.json(
          {
            error: "Database table not found",
            details: "The purchase_orders table does not exist. Please run database migrations.",
            code: "TABLE_NOT_FOUND",
            prismaCode: countError.code,
            step: errorContext.step,
            hint: "Run: npx prisma migrate deploy or check database schema",
          },
          { status: 500 }
        );
      }
      
      // Check for missing column error (PostgreSQL error code 42703)
      if (countError.message?.includes('column') && 
          (countError.message?.includes('does not exist') || 
           countError.message?.includes('vessel_name') ||
           countError.code === '42703')) {
        return NextResponse.json(
          {
            error: "Database schema mismatch",
            details: "The vessel_name column does not exist in purchase_orders table. Please run the migration SQL file.",
            code: "COLUMN_NOT_FOUND",
            prismaCode: countError.code,
            step: errorContext.step,
            hint: "Run the SQL migration file: prisma/migrations/add_vessel_id_to_purchase_orders.sql",
            migrationFile: "prisma/migrations/add_vessel_id_to_purchase_orders.sql",
            errorMessage: countError.message,
          },
          { status: 500 }
        );
      }
      
      if (countError.code === 'P2003') {
        return NextResponse.json(
          {
            error: "Foreign key constraint error",
            details: countError.meta?.field_name 
              ? `Invalid reference in field: ${countError.meta.field_name}`
              : "Invalid foreign key reference in query",
            code: "FK_CONSTRAINT_ERROR",
            prismaCode: countError.code,
            step: errorContext.step,
            field: countError.meta?.field_name,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Failed to count purchase orders",
          details: countError.message || "Database count query failed",
          code: countError.code || "COUNT_ERROR",
          prismaCode: countError.code,
          step: errorContext.step,
          meta: countError.meta,
          fullError: process.env.NODE_ENV === 'development' ? countError.stack : undefined,
        },
        { status: 500 }
      );
    }

    // Step 6: Fetch purchase orders
    errorContext.step = 'fetch_records';
    let purchaseOrders: any[];
    try {
      purchaseOrders = await prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          requisition: {
            select: {
              id: true,
              requisitionNumber: true,
              heading: true,
              vessel: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          quote: {
            select: {
              quoteNumber: true,
              vendor: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          dateOfIssue: "desc",
        },
      });
      errorContext.fetchedCount = purchaseOrders.length;
    } catch (fetchError: any) {
      console.error("[EXTRACT-ALL] Fetch query error:", fetchError);
      console.error("[EXTRACT-ALL] Fetch error details:", {
        code: fetchError.code,
        meta: fetchError.meta,
        message: fetchError.message,
        stack: fetchError.stack,
      });
      
      // Check for specific Prisma errors
      if (fetchError.code === 'P2021') {
        return NextResponse.json(
          {
            error: "Database table not found",
            details: "The purchase_orders table or related tables do not exist. Please run database migrations.",
            code: "TABLE_NOT_FOUND",
            prismaCode: fetchError.code,
            step: errorContext.step,
            hint: "Run: npx prisma migrate deploy",
          },
          { status: 500 }
        );
      }
      
      // Check for missing column error (PostgreSQL error code 42703)
      if (fetchError.message?.includes('column') && 
          (fetchError.message?.includes('does not exist') || 
           fetchError.message?.includes('vessel_name') ||
           fetchError.code === '42703')) {
        return NextResponse.json(
          {
            error: "Database schema mismatch",
            details: "The vessel_name column does not exist in purchase_orders table. Please run the migration SQL file.",
            code: "COLUMN_NOT_FOUND",
            prismaCode: fetchError.code,
            step: errorContext.step,
            hint: "Run the SQL migration file: prisma/migrations/add_vessel_id_to_purchase_orders.sql",
            migrationFile: "prisma/migrations/add_vessel_id_to_purchase_orders.sql",
            errorMessage: fetchError.message,
          },
          { status: 500 }
        );
      }
      
      if (fetchError.code === 'P2003') {
        return NextResponse.json(
          {
            error: "Foreign key constraint error",
            details: fetchError.meta?.field_name 
              ? `Invalid reference in field: ${fetchError.meta.field_name}`
              : "Invalid foreign key reference in query",
            code: "FK_CONSTRAINT_ERROR",
            prismaCode: fetchError.code,
            step: errorContext.step,
            field: fetchError.meta?.field_name,
          },
          { status: 500 }
        );
      }
      
      if (fetchError.code === 'P2010') {
        return NextResponse.json(
          {
            error: "Raw query error",
            details: fetchError.meta?.message || "Database query execution failed",
            code: "RAW_QUERY_ERROR",
            prismaCode: fetchError.code,
            step: errorContext.step,
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Failed to fetch purchase orders",
          details: fetchError.message || "Database fetch query failed",
          code: fetchError.code || "FETCH_ERROR",
          prismaCode: fetchError.code,
          step: errorContext.step,
          meta: fetchError.meta,
          fullError: process.env.NODE_ENV === 'development' ? fetchError.stack : undefined,
        },
        { status: 500 }
      );
    }

    // Step 7: Format response data
    errorContext.step = 'format_response';
    let formattedOrders: any[];
    try {
      formattedOrders = purchaseOrders.map((po) => {
        try {
          return {
            id: po.id,
            poNumber: po.poNumber,
            dateOfIssue: po.dateOfIssue?.toISOString() || null,
            totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
            currency: po.currency,
            status: po.status,
            completionStatus: po.completionStatus,
            requisition: {
              id: po.requisition?.id || null,
              requisitionNumber: po.requisition?.requisitionNumber || null,
              heading: po.requisition?.heading || null,
              vessel: po.requisition?.vessel
                ? {
                    id: po.requisition.vessel.id,
                    name: po.requisition.vessel.name,
                    code: po.requisition.vessel.code,
                  }
                : null,
            },
            quote: {
              quoteNumber: po.quote?.quoteNumber || null,
              vendor: {
                id: po.quote?.vendor?.id || null,
                name: po.quote?.vendor?.name || null,
              },
            },
            createdAt: po.createdAt?.toISOString() || null,
          };
        } catch (formatError: any) {
          console.error(`[EXTRACT-ALL] Error formatting PO ${po.id}:`, formatError);
          // Return a safe fallback object
          return {
            id: po.id || 'unknown',
            poNumber: po.poNumber || 'N/A',
            dateOfIssue: null,
            totalAmount: null,
            currency: 'USD',
            status: 'UNKNOWN',
            completionStatus: 'UNKNOWN',
            requisition: { id: null, requisitionNumber: null, heading: null, vessel: null },
            quote: { quoteNumber: null, vendor: { id: null, name: null } },
            createdAt: null,
            _error: `Format error: ${formatError.message}`,
          };
        }
      });
      errorContext.formattedCount = formattedOrders.length;
    } catch (formatError: any) {
      console.error("[EXTRACT-ALL] Format error:", formatError);
      return NextResponse.json(
        {
          error: "Failed to format purchase orders",
          details: formatError.message || "Data formatting failed",
          code: "FORMAT_ERROR",
          step: errorContext.step,
        },
        { status: 500 }
      );
    }

    // Step 8: Return successful response
    errorContext.step = 'return_response';
    try {
      return NextResponse.json({
        success: true,
        purchaseOrders: formattedOrders,
        count: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      });
    } catch (responseError: any) {
      console.error("[EXTRACT-ALL] Response serialization error:", responseError);
      return NextResponse.json(
        {
          error: "Failed to serialize response",
          details: responseError.message || "JSON serialization failed",
          code: "SERIALIZATION_ERROR",
          step: errorContext.step,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // Catch-all for any unexpected errors
    console.error("[EXTRACT-ALL] Unexpected error:", error);
    console.error("[EXTRACT-ALL] Error stack:", error.stack);
    console.error("[EXTRACT-ALL] Error context:", errorContext);
    console.error("[EXTRACT-ALL] Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
      name: error.name,
    });
    
    // Check for Prisma-specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: "Database constraint violation",
          details: error.meta?.target 
            ? `Unique constraint violation on: ${error.meta.target.join(', ')}`
            : "Unique constraint failed",
          code: "UNIQUE_CONSTRAINT_ERROR",
          prismaCode: error.code,
          step: errorContext.step,
          meta: error.meta,
        },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        {
          error: "Record not found",
          details: error.meta?.cause || "The requested record does not exist",
          code: "RECORD_NOT_FOUND",
          prismaCode: error.code,
          step: errorContext.step,
          meta: error.meta,
        },
        { status: 404 }
      );
    }
    
    if (error.code === 'P2021') {
      return NextResponse.json(
        {
          error: "Database table not found",
          details: error.meta?.cause || "Required database table does not exist",
          code: "TABLE_NOT_FOUND",
          prismaCode: error.code,
          step: errorContext.step,
          hint: "Run database migrations: npx prisma migrate deploy",
        },
        { status: 500 }
      );
    }
    
    if (error.code === 'P1001') {
      return NextResponse.json(
        {
          error: "Database connection failed",
          details: "Cannot reach the database server",
          code: "DB_CONNECTION_ERROR",
          prismaCode: error.code,
          step: errorContext.step,
          hint: "Check database connection string and server status",
        },
        { status: 503 }
      );
    }
    
    if (error.code === 'P1017') {
      return NextResponse.json(
        {
          error: "Database server closed connection",
          details: "The database server closed the connection unexpectedly",
          code: "DB_CONNECTION_CLOSED",
          prismaCode: error.code,
          step: errorContext.step,
          hint: "Database server may be overloaded or restarting",
        },
        { status: 503 }
      );
    }
    
    // Generic error response with all available context
    return NextResponse.json(
      {
        error: "Failed to extract purchase orders",
        details: error instanceof Error ? error.message : "Unknown error occurred",
        code: error.code || 'UNKNOWN_ERROR',
        prismaCode: error.code,
        step: errorContext.step,
        hint: error.meta?.cause || 'Check database connection, table structure, and server logs',
        errorType: error.name || 'Error',
        context: {
          step: errorContext.step,
          timestamp: errorContext.timestamp,
        },
      },
      { status: 500 }
    );
  }
}
