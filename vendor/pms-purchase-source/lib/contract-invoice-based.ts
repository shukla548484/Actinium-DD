import type { ContractType } from "@prisma/client";

export const CONTRACT_TYPE_INVOICE_BASED = "INVOICE_BASED" as const;

export type InvoiceBasedContractType = typeof CONTRACT_TYPE_INVOICE_BASED;

export function isInvoiceBasedContractType(
  contractType: ContractType | string | null | undefined
): boolean {
  return contractType === CONTRACT_TYPE_INVOICE_BASED;
}

/** Minimum access level to approve invoices tied to invoice-based contracts. */
export const CONTRACT_INVOICE_APPROVAL_MIN_ACCESS = 37;

export function canApproveContractBasedInvoice(accessLevel: number | null | undefined): boolean {
  return (accessLevel ?? 0) >= CONTRACT_INVOICE_APPROVAL_MIN_ACCESS;
}
