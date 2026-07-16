import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  FileBarChart,
  FileEdit,
  FilePlus,
  FileSignature,
  FileText,
  Library,
  ListChecks,
  MessageSquareText,
  Package,
  Receipt,
  ReceiptText,
  Scale,
  ShoppingCart,
  Store,
} from "lucide-react";

/**
 * Purchase module navigation — mirrored from app-pms-updated TopNavigation Purchase menu.
 * accessLevels / minAccessLevel map to designationAccessLevel (PMS); SYS_ADMIN always passes.
 */
export type PurchaseNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  group: PurchaseNavGroup;
  /** Exact designation access levels that may see this item. */
  accessLevels?: number[];
  /** Minimum designation access level (inclusive). */
  minAccessLevel?: number;
};

export const purchaseNavGroups = [
  "Overview",
  "Requisitions",
  "Sourcing",
  "Orders & finance",
  "Vendors & reports",
] as const;

export type PurchaseNavGroup = (typeof purchaseNavGroups)[number];

export const purchaseNavItems: PurchaseNavItem[] = [
  {
    id: "dashboard",
    label: "Purchase Dashboard",
    href: "/purchase/dashboard",
    description: "KPIs, vessel filter, requisition and PO overview",
    icon: BarChart3,
    group: "Overview",
  },
  {
    id: "create-requisition",
    label: "Create Requisition",
    href: "/purchase/create-requisition",
    description: "Raise a new purchase requisition",
    icon: FilePlus,
    group: "Requisitions",
  },
  {
    id: "draft-requisitions",
    label: "Draft Requisitions",
    href: "/purchase/draft-requisitions",
    description: "Continue incomplete requisitions",
    icon: FileEdit,
    group: "Requisitions",
  },
  {
    id: "view-requisitions",
    label: "Requisitions",
    href: "/purchase/view-requisitions",
    description: "All requisitions — approve, RFQ, quote compare",
    icon: ClipboardList,
    group: "Requisitions",
  },
  {
    id: "clarifications",
    label: "RFQ Clarifications",
    href: "/purchase/clarifications",
    description: "Vendor Q&A during RFQ",
    icon: MessageSquareText,
    group: "Sourcing",
  },
  {
    id: "knowledge-library",
    label: "Knowledge Library",
    href: "/purchase/knowledge-library",
    description: "Reusable procurement knowledge packs",
    icon: Library,
    group: "Sourcing",
  },
  {
    id: "contracts",
    label: "Contracts",
    href: "/purchase/contracts",
    description: "Frame agreements and contract POs",
    icon: FileSignature,
    group: "Sourcing",
  },
  {
    id: "bulk-purchasing",
    label: "Bulk Purchasing",
    href: "/purchase/bulk-purchasing",
    description: "Multi-vessel / bulk buy workflows",
    icon: ShoppingCart,
    group: "Sourcing",
  },
  {
    id: "budget-control",
    label: "Budget Control",
    href: "/purchase/budget-control",
    description: "Fleet purchase budget monitor and accruals",
    icon: DollarSign,
    group: "Orders & finance",
    minAccessLevel: 28,
  },
  {
    id: "create-quote",
    label: "Create Quote",
    href: "/purchase/create-quote",
    description: "Purchaser quote entry",
    icon: Receipt,
    group: "Sourcing",
    accessLevels: [50, 32, 33],
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders (All)",
    href: "/purchase/purchase-orders",
    description: "PO hub — approve, send, track",
    icon: ListChecks,
    group: "Orders & finance",
  },
  {
    id: "credit-notes",
    label: "Credit Notes",
    href: "/purchase/credit-notes",
    description: "Vendor credit notes",
    icon: ReceiptText,
    group: "Orders & finance",
  },
  {
    id: "invoices",
    label: "Invoices",
    href: "/purchase/invoices",
    description: "Invoice workbench and verification",
    icon: FileText,
    group: "Orders & finance",
  },
  {
    id: "po-budget-change",
    label: "PO Budget Change",
    href: "/purchase/po-budget-change",
    description: "Reclassify PO budget after invoice",
    icon: Scale,
    group: "Orders & finance",
    accessLevels: [30, 31, 44, 45, 46, 47, 48, 50, 99, 100],
  },
  {
    id: "dn-status",
    label: "DN Status",
    href: "/purchase/dn-status",
    description: "Delivery note tracking",
    icon: ClipboardCheck,
    group: "Orders & finance",
  },
  {
    id: "onboard-receipt",
    label: "Onboard Receipt",
    href: "/purchase/requisitions/receipt-confirmation",
    description: "Crew receipt confirmation of ordered goods",
    icon: Package,
    group: "Requisitions",
    accessLevels: [20, 21, 22, 23, 24],
  },
  {
    id: "vendor-management",
    label: "Vendor Management",
    href: "/purchase/vendor-management",
    description: "Vendors, verification, blacklist",
    icon: Store,
    group: "Vendors & reports",
  },
  {
    id: "invoicer-payer",
    label: "Invoicer/Payer",
    href: "/purchase/invoicer-payer",
    description: "Invoice payer company mapping",
    icon: Building2,
    group: "Vendors & reports",
  },
  {
    id: "reports",
    label: "Reports",
    href: "/purchase/reports",
    description: "Purchase reports and exports",
    icon: FileBarChart,
    group: "Vendors & reports",
  },
];

/** Deep-link routes that exist in PMS but are not top-nav items. */
export const purchaseDeepRoutes: { href: string; label: string; description: string }[] = [
  { href: "/purchase/create-po", label: "Create PO", description: "Issue purchase order from confirmed quote" },
  { href: "/purchase/view-pos", label: "View POs", description: "Redirects to PO hub" },
  { href: "/purchase/quote-comparison", label: "Quote comparison", description: "Side-by-side vendor quotes" },
  { href: "/purchase/freight", label: "Freight", description: "Freight declarations and freight POs" },
  { href: "/purchase/freight-approvals", label: "Freight approvals", description: "Approve freight charges" },
  { href: "/purchase/master-approval", label: "Master approval", description: "Onboard master requisition approval" },
  { href: "/purchase/inventory-management", label: "Inventory", description: "Store / inventory linkage" },
  { href: "/purchase/store-items", label: "Store items", description: "Store item catalog for requisitions" },
];

export function resolvePurchaseNavId(pathname: string): string {
  const exact = purchaseNavItems.find((i) => pathname === i.href);
  if (exact) return exact.id;
  const prefix = [...purchaseNavItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname.startsWith(`${i.href}/`) || pathname === i.href);
  return prefix?.id ?? "dashboard";
}

const ADMIN_EQUIVALENT = new Set([50, 99, 100]);

export function canSeePurchaseNavItem(
  item: PurchaseNavItem,
  designationAccessLevel: number | null | undefined,
  isSysAdmin = false,
): boolean {
  if (isSysAdmin) return true;
  const level = designationAccessLevel ?? 0;
  if (ADMIN_EQUIVALENT.has(level)) return true;
  if (item.accessLevels?.length) return item.accessLevels.includes(level);
  if (item.minAccessLevel != null) return level >= item.minAccessLevel;
  return true;
}
