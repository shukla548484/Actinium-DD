export type InvoiceVerificationMode = "view" | "approve";

export function buildInvoiceVerificationUrl(
  invoiceId: string,
  options?: { fromNotification?: boolean; mode?: InvoiceVerificationMode }
): string {
  const params = new URLSearchParams({
    invoiceId,
    invoiceAction: options?.mode === "view" ? "view" : "verify",
  });
  if (options?.fromNotification) {
    params.set("from", "notification");
  }
  return `/purchase/invoices?${params.toString()}`;
}
