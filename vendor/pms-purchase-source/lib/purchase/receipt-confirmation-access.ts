/** Crew ranks that may confirm onboard receipt (received vs ordered qty). */
export const ONBOARD_RECEIPT_ACCESS_LEVELS = [20, 21, 22, 23, 24] as const;

export function canConfirmOnboardReceipt(
  accessLevel: number | null | undefined
): boolean {
  const level = accessLevel ?? 0;
  return level >= 20 && level <= 24;
}
