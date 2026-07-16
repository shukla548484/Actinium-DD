/** Vendor registration verification — purchasers (32/33) and admins (50/99/100) confirm before portal access. */

import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

export const VENDOR_VERIFICATION_STATUS = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export type VendorVerificationStatus =
  (typeof VENDOR_VERIFICATION_STATUS)[keyof typeof VENDOR_VERIFICATION_STATUS];

export function canVerifyVendorRegistration(accessLevel: number | null | undefined): boolean {
  return (
    accessLevel === 32 ||
    accessLevel === 33 ||
    isAdminEquivalentAccessLevel(accessLevel)
  );
}

export function vendorHasPlatformAccess(vendor: {
  registrationComplete: boolean;
  verificationStatus: string;
}): boolean {
  return (
    vendor.registrationComplete &&
    vendor.verificationStatus === VENDOR_VERIFICATION_STATUS.VERIFIED
  );
}

export function vendorVerificationLabel(status: string): string {
  switch (status) {
    case VENDOR_VERIFICATION_STATUS.VERIFIED:
      return "Verified";
    case VENDOR_VERIFICATION_STATUS.REJECTED:
      return "Rejected";
    case VENDOR_VERIFICATION_STATUS.PENDING:
    default:
      return "Pending verification";
  }
}
