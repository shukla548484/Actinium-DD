import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";

/** Office users who may upload delivery notes on Purchase → DN Status. */
export function canUserUploadDeliveryNote(accessLevel: number): boolean {
  return (
    (accessLevel >= 17 && accessLevel <= 25) ||
    accessLevel === 32 ||
    accessLevel === 33 ||
    isAdminEquivalentAccessLevel(accessLevel)
  );
}

export const DN_UPLOAD_ACCESS_DENIED_MESSAGE =
  "Insufficient permissions. Access levels 17–25, 32–33, or admin (50, 99, 100) are required to upload delivery notes.";
