/** Client-safe purchase DTOs — no server-only imports. */

export type PurchaseDashboardStats = {
  totalRequisitions: number;
  pendingRequisitions: number;
  approvedRequisitions: number;
  totalQuotes: number;
  totalPurchaseOrders: number;
  totalInvoices: number;
  totalAmount: number;
  pendingAmount: number;
};

export const EMPTY_PURCHASE_DASHBOARD_STATS: PurchaseDashboardStats = {
  totalRequisitions: 0,
  pendingRequisitions: 0,
  approvedRequisitions: 0,
  totalQuotes: 0,
  totalPurchaseOrders: 0,
  totalInvoices: 0,
  totalAmount: 0,
  pendingAmount: 0,
};

export type PurchaseRequisitionListRow = {
  id: string;
  requisitionNumber: string;
  heading: string;
  vesselId: string;
  vesselName: string;
  vesselCode: string;
  requisitionType: string;
  status: string;
  generationStatus: string;
  priority: string;
  createdByName: string;
  createdAt: string;
  approvedAt: string | null;
  itemCount: number;
};

export type PurchaseVendorListRow = {
  id: string;
  vendorCode: string;
  name: string;
  primaryEmail: string;
  country: string;
  city: string | null;
  isActive: boolean;
  isBlacklisted: boolean;
  verificationStatus: string;
  preferredCurrency: string;
  serviceTypes: string[];
};

export type PurchaseOrderListRow = {
  id: string;
  poNumber: string;
  vesselId: string;
  vesselName: string;
  status: string;
  completionStatus: string;
  totalAmount: number;
  currency: string;
  dateOfIssue: string;
  requisitionNumber: string;
};

export type PurchaseInvoiceListRow = {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  invoiceAmount: number;
  currency: string;
  status: string;
  invoiceDate: string;
  requisitionNumber: string;
  poNumber: string | null;
};
