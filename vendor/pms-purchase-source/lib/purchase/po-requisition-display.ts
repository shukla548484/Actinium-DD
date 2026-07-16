/** PO Details column: prefer requisition description, then heading. */
export function purchaseOrderDetailsText(requisition: {
  heading?: string | null;
  description?: string | null;
}): string {
  const description = requisition.description?.trim();
  if (description) return description;
  const heading = requisition.heading?.trim();
  return heading || "—";
}
