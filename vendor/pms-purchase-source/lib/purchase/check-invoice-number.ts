/**
 * Client helper — verify invoice number uniqueness before submit.
 */
export async function checkInvoiceNumberAvailable(
  invoiceNumber: string,
  excludeId?: string | null
): Promise<boolean> {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) return false;

  const params = new URLSearchParams({ invoiceNumber: trimmed });
  if (excludeId) params.set("excludeId", excludeId);

  const response = await fetch(`/api/invoices/check-number?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to verify invoice number");
  }

  const data = (await response.json()) as { available?: boolean };
  return Boolean(data.available);
}
