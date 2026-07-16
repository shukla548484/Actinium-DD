import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/session';
import { 
  RequisitionType,
  generateRequisitionNumberForOrigin,
  canCreateRequisition,
  canOfficeCreateRequisition,
  OFFICE_REQUISITION_CREATOR_MIN_ACCESS,
} from '@/lib/types/requisition';
import { recordOriginForRequest } from '@/lib/sync/vessel-local-push';
import { requisitionNumberPrefix } from '@/lib/sync/record-origin-suffix';

// Reservation expires after 10 minutes
const RESERVATION_EXPIRY_MINUTES = 10;

/**
 * GET /api/requisitions/next-number - Calculate and reserve next requisition number
 * Query params: vesselId, requisitionType
 * 
 * This endpoint:
 * 1. Cleans up expired reservations
 * 2. Finds the next available sequence (considering both actual requisitions and active reservations)
 * 3. Reserves the number for the current user
 * 4. Returns the reserved number
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get('vesselId');
    const requisitionType = searchParams.get('requisitionType') as RequisitionType;

    if (!vesselId || !requisitionType) {
      return NextResponse.json(
        { error: 'vesselId and requisitionType are required' },
        { status: 400 }
      );
    }

    // Get user's access level from database
    // IMPORTANT: Always use designationAccessLevel from database, NOT hardcoded mapping
    const creator = await prisma.employee.findUnique({
      where: { id: currentUser.id },
      select: { designationAccessLevel: true }
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const accessLevel = creator.designationAccessLevel;

    if (!canCreateRequisition(accessLevel) && !canOfficeCreateRequisition(accessLevel)) {
      return NextResponse.json(
        {
          error:
            `Insufficient access level to reserve a requisition number. Required: vessel crew 17–25 or office ${OFFICE_REQUISITION_CREATOR_MIN_ACCESS}+.`,
        },
        { status: 403 }
      );
    }

    // Get vessel for requisition number generation
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { code: true }
    });

    if (!vessel) {
      return NextResponse.json(
        { error: 'Vessel not found' },
        { status: 404 }
      );
    }

    // Calculate next requisition number with reservation
    const year = new Date().getFullYear();
    const origin = recordOriginForRequest(request, accessLevel);
    const prefix = requisitionNumberPrefix(origin);
    const yearSuffix = year.toString().slice(-2);
    const pattern = `${prefix}.${vessel.code}.${requisitionType}.${yearSuffix}.%`;

    console.log('[Next Number API] Calculating next number with reservation:', {
      vesselId,
      requisitionType,
      pattern,
      accessLevel,
      userId: currentUser.id,
    });

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Clean up expired reservations
      const now = new Date();
      await tx.$executeRaw`
        DELETE FROM requisition_number_reservations
        WHERE expires_at < ${now}::timestamptz
      `;

      // Step 2: Get max sequence from actual requisitions
      const reqResult = await tx.$queryRaw<Array<{ max_sequence: number | null }>>`
        SELECT MAX(
          CAST(
            SPLIT_PART(requisition_number, '.', 5) AS INTEGER
          )
        ) as max_sequence
        FROM requisitions
        WHERE vessel_id = ${vesselId}::uuid
          AND requisition_type::text = ${requisitionType}
          AND requisition_number LIKE ${pattern}
      `;

      let maxSequenceFromRequisitions = 0;
      if (reqResult && Array.isArray(reqResult) && reqResult.length > 0 && reqResult[0]?.max_sequence !== null) {
        const maxSeq = Number(reqResult[0].max_sequence);
        if (!isNaN(maxSeq) && maxSeq > 0) {
          maxSequenceFromRequisitions = maxSeq;
        }
      }

      // Step 3: Get max sequence from active reservations
      const reservationResult = await tx.$queryRaw<Array<{ max_sequence: number | null }>>`
        SELECT MAX(
          CAST(
            SPLIT_PART(requisition_number, '.', 5) AS INTEGER
          )
        ) as max_sequence
        FROM requisition_number_reservations
        WHERE vessel_id = ${vesselId}::uuid
          AND requisition_type::text = ${requisitionType}
          AND requisition_number LIKE ${pattern}
          AND expires_at > ${now}::timestamptz
      `;

      let maxSequenceFromReservations = 0;
      if (reservationResult && Array.isArray(reservationResult) && reservationResult.length > 0 && reservationResult[0]?.max_sequence !== null) {
        const maxSeq = Number(reservationResult[0].max_sequence);
        if (!isNaN(maxSeq) && maxSeq > 0) {
          maxSequenceFromReservations = maxSeq;
        }
      }

      // Step 4: Calculate next sequence (max of both + 1)
      const nextSequence = Math.max(maxSequenceFromRequisitions, maxSequenceFromReservations) + 1;

      // Step 5: Generate requisition number
      const requisitionNumber = generateRequisitionNumberForOrigin(
        vessel,
        requisitionType,
        year,
        nextSequence,
        origin
      );

      // Step 6: Check if this number is already reserved (shouldn't happen, but double-check)
      const existingReservation = await tx.requisitionNumberReservation.findUnique({
        where: { requisitionNumber },
      });

      if (existingReservation && existingReservation.expiresAt > now) {
        // Number is already reserved, try next one
        const nextSequence2 = nextSequence + 1;
        const requisitionNumber2 = generateRequisitionNumberForOrigin(
          vessel,
          requisitionType,
          year,
          nextSequence2,
          origin
        );
        
        // Reserve the next available number
        const expiresAt = new Date(now.getTime() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);
        await tx.requisitionNumberReservation.create({
          data: {
            requisitionNumber: requisitionNumber2,
            vesselId,
            requisitionType,
            reservedBy: currentUser.id,
            expiresAt,
          },
        });

        return {
          requisitionNumber: requisitionNumber2,
          sequence: nextSequence2,
          reserved: true,
        };
      }

      // Step 7: Reserve the number
      const expiresAt = new Date(now.getTime() + RESERVATION_EXPIRY_MINUTES * 60 * 1000);
      await tx.requisitionNumberReservation.create({
        data: {
          requisitionNumber,
          vesselId,
          requisitionType,
          reservedBy: currentUser.id,
          expiresAt,
        },
      });

      return {
        requisitionNumber,
        sequence: nextSequence,
        reserved: true,
      };
    });

    console.log('[Next Number API] Reserved number:', result.requisitionNumber);

    return NextResponse.json({
      requisitionNumber: result.requisitionNumber,
      sequence: result.sequence,
      prefix,
      vesselCode: vessel.code,
      requisitionType,
      year,
      accessLevel,
      reserved: true,
      expiresAt: new Date(Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('[Next Number API] Error:', error);
    
    // Handle unique constraint violation (race condition)
    if (error.code === 'P2002') {
      return GET(request);
    }

    // CHE / new enum values: return preview number without DB reservation when enum not migrated
    const { searchParams } = new URL(request.url);
    const vesselId = searchParams.get("vesselId");
    const requisitionType = searchParams.get("requisitionType") as RequisitionType;
    if (vesselId && requisitionType) {
      try {
        const vessel = await prisma.vessel.findUnique({
          where: { id: vesselId },
          select: { code: true },
        });
        if (vessel) {
          const creator = await prisma.employee.findUnique({
            where: { id: (await getCurrentUserFromRequest(request))?.id ?? "" },
            select: { designationAccessLevel: true },
          });
          const accessLevel = creator?.designationAccessLevel ?? 25;
          const origin = recordOriginForRequest(request, accessLevel);
          const year = new Date().getFullYear();
          const requisitionNumber = generateRequisitionNumberForOrigin(
            vessel,
            requisitionType,
            year,
            1,
            origin
          );
          return NextResponse.json({
            requisitionNumber,
            sequence: 1,
            prefix: requisitionNumberPrefix(origin),
            vesselCode: vessel.code,
            requisitionType,
            year,
            accessLevel,
            reserved: false,
          });
        }
      } catch (fallbackError) {
        console.error("[Next Number API] Fallback failed:", fallbackError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to calculate next requisition number',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

