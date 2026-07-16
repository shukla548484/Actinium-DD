import { NextRequest, NextResponse } from 'next/server';
import { secureApiRoute, SecureRequestContext } from '@/lib/api-security';
import prisma from '@/lib/prisma';
import {
  parseVendorExcel,
  validateVendorBulkRow,
  buildVendorOnboardingDataFromBulkRow,
} from '@/lib/excel-vendor-utils';
import { generateNextVendorId } from '@/lib/vendor-id-generator';
import { normalizeVendorEmail } from '@/lib/vendor-registration';
import { VENDOR_VERIFICATION_STATUS } from '@/lib/vendor-verification';
import { logVendorRegistrationAudit } from '@/lib/vendor-registration-audit';

async function resolveVendorPortIds(
  labels: string[]
): Promise<{ portIds: string[]; unmatched: string[] }> {
  const portIds: string[] = [];
  const unmatched: string[] = [];

  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;

    const port =
      (await prisma.port.findFirst({
        where: {
          isActive: true,
          OR: [
            { code: { equals: label, mode: 'insensitive' } },
            { name: { equals: label, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })) ??
      (await prisma.port.findFirst({
        where: {
          isActive: true,
          OR: [
            { name: { contains: label, mode: 'insensitive' } },
            { country: { equals: label, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      }));

    if (port) {
      if (!portIds.includes(port.id)) portIds.push(port.id);
    } else {
      unmatched.push(label);
    }
  }

  return { portIds, unmatched };
}

/**
 * POST /api/vendors/bulk-upload - Bulk upload vendors from Excel file
 * SECURITY: Protected by secureApiRoute - requires authentication
 */
const handler = async (
  request: NextRequest,
  context: SecureRequestContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel (.xlsx or .xls) files only.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const vendorsData = parseVendorExcel(buffer);

    if (vendorsData.length === 0) {
      return NextResponse.json(
        { error: 'No vendor data found in Excel file. Remove the sample row and add your data.' },
        { status: 400 }
      );
    }

    const enriched = await Promise.all(
      vendorsData.map(async (row) => {
        const { portIds, unmatched } = await resolveVendorPortIds(row.portLabels);
        const validationError = validateVendorBulkRow(row, portIds, unmatched);
        return {
          ...row,
          portIds,
          unmatchedPorts: unmatched,
          validationError,
          primaryEmail: normalizeVendorEmail(row.primaryEmail),
        };
      })
    );

    if (isPreview) {
      return NextResponse.json({
        vendors: enriched.map((v) => ({
          name: v.name,
          primaryEmail: v.primaryEmail,
          country: v.country,
          serviceTypes: v.serviceTypes,
          portLabels: v.portLabels,
          portIds: v.portIds,
          rating: v.rating,
          validationError: v.validationError,
          unmatchedPorts: v.unmatchedPorts,
        })),
        count: enriched.length,
        validCount: enriched.filter((v) => !v.validationError).length,
      });
    }

    const currentUser = context.user;
    let masterCompanyId: string | null = null;

    if (currentUser?.company) {
      const userCompany = await prisma.company.findUnique({
        where: { id: currentUser.company.id },
        include: { parent: true },
      });

      if (userCompany) {
        if (userCompany.type === 'MASTER_COMPANY') {
          masterCompanyId = userCompany.id;
        } else if (userCompany.parent) {
          masterCompanyId = userCompany.parent.id;
        } else {
          masterCompanyId = userCompany.id;
        }
      }
    }

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; vendor: string; error: string }>,
      createdVendorIds: [] as Array<{ id: string; name: string }>,
    };

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < enriched.length; i++) {
        const vendorData = enriched[i]!;
        const rowNumber = i + 2;

        try {
          if (vendorData.validationError) {
            results.errors.push({
              row: rowNumber,
              vendor: vendorData.name,
              error: vendorData.validationError,
            });
            results.failed++;
            continue;
          }

          const existingVendor = await tx.vendor.findFirst({
            where: {
              OR: [
                { primaryEmail: { equals: vendorData.primaryEmail, mode: 'insensitive' } },
                { secondaryEmail: { equals: vendorData.primaryEmail, mode: 'insensitive' } },
                { commonEmail: { equals: vendorData.primaryEmail, mode: 'insensitive' } },
                { additionalEmail: { equals: vendorData.primaryEmail, mode: 'insensitive' } },
              ],
            },
          });

          if (existingVendor) {
            results.errors.push({
              row: rowNumber,
              vendor: vendorData.name,
              error: `Vendor with email ${vendorData.primaryEmail} already exists`,
            });
            results.failed++;
            continue;
          }

          const onboardingData = buildVendorOnboardingDataFromBulkRow(
            vendorData,
            vendorData.portIds
          );
          const vendorId = await generateNextVendorId();
          const umbrellaCompanyId = masterCompanyId || null;
          const now = new Date();

          const created = await tx.vendor.create({
            data: {
              vendorId,
              name: vendorData.name.trim(),
              primaryEmail: vendorData.primaryEmail,
              secondaryEmail: vendorData.secondaryEmail?.trim() || null,
              commonEmail: null,
              additionalEmail: null,
              phone: vendorData.phone!.trim(),
              address: vendorData.address!.trim(),
              country: vendorData.country.trim(),
              city: vendorData.city?.trim() || null,
              contactPerson: vendorData.contactPerson!.trim(),
              serviceTypes: vendorData.serviceTypes,
              serviceCountries: vendorData.serviceCountries,
              rating: vendorData.rating ?? null,
              isBlacklisted: false,
              blacklistReason: null,
              umbrellaCompanyId,
              masterCompanyId,
              isActive: vendorData.isActive,
              companyRegistrationNumber: vendorData.companyRegistrationNumber!.trim(),
              preferredCurrency: vendorData.preferredCurrency!.trim(),
              vatNumber: vendorData.vatNumber?.trim() || null,
              productDescription: vendorData.productDescription?.trim() || null,
              registrationComplete: true,
              registrationCompletedAt: now,
              verificationStatus: VENDOR_VERIFICATION_STATUS.PENDING,
              verifiedAt: null,
              verifiedById: null,
              onboardingStep: 6,
              onboardingData: onboardingData as object,
              invitedById: currentUser?.id ?? null,
            },
          });

          if (vendorData.portIds.length > 0) {
            await tx.vendorPort.createMany({
              data: vendorData.portIds.map((portId) => ({
                vendorId: created.id,
                portId,
              })),
              skipDuplicates: true,
            });
          }

          results.successful++;
          results.createdVendorIds.push({ id: created.id, name: vendorData.name });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({
            row: rowNumber,
            vendor: vendorData.name || 'Unknown',
            error: errorMessage,
          });
          results.failed++;
        }
      }
    });

    for (const v of results.createdVendorIds) {
      await logVendorRegistrationAudit({
        request,
        action: "VENDOR_BULK_REGISTERED",
        vendorId: v.id,
        vendorName: v.name,
        companyId: masterCompanyId,
        actorEmployeeId: currentUser?.id,
        actorRole: String(currentUser?.designationAccessLevel ?? ""),
        newValue: {
          registrationComplete: true,
          verificationStatus: VENDOR_VERIFICATION_STATUS.PENDING,
        },
        activityDescription: `Bulk-uploaded vendor pending verification: ${v.name}`,
        page: "/purchase/vendor-management",
      });
    }

    return NextResponse.json({
      successful: results.successful,
      failed: results.failed,
      total: enriched.length,
      errors: results.errors,
      message: `Successfully created ${results.successful} vendors. ${results.failed} failed.`,
    });
  } catch (error: unknown) {
    console.error('Error in bulk vendor upload:', error);
    return NextResponse.json(
      {
        error: 'Failed to process bulk vendor upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};

export const POST = secureApiRoute(handler, {
  requireAuth: true,
  allowedMethods: ['POST'],
  minAccessLevel: 10,
});
