const APP_BASE = () =>
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.actinium-sm.org";

export type QuotePoNavOptions = {
  from?: "notification";
  childRequisitionId?: string | null;
  /** After any PO tier rejection — open create-po (replace unsent PO), not send/confirm. */
  revision?: boolean;
};

function appendQuery(path: string, params: URLSearchParams): string {
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

import {
  PURCHASE_ORDERS_HUB_PATH,
  PURCHASE_ORDERS_HUB_TABS,
} from "@/lib/purchase/purchase-orders-hub";

/** Purchaser creates/edits the PO record (32/33) — first step after quote approval. */
export function quoteCreatePoPath(quoteId: string, options?: QuotePoNavOptions): string {
  const params = new URLSearchParams({ quoteId, tab: PURCHASE_ORDERS_HUB_TABS.create });
  if (options?.from === "notification") params.set("from", "notification");
  if (options?.childRequisitionId?.trim()) {
    params.set("childRequisitionId", options.childRequisitionId.trim());
  }
  if (options?.revision) {
    params.set("revision", "1");
  }
  return appendQuery(PURCHASE_ORDERS_HUB_PATH, params);
}

export function quoteCreatePoUrl(quoteId: string, options?: QuotePoNavOptions): string {
  return `${APP_BASE()}${quoteCreatePoPath(quoteId, options)}`;
}

/** Send PO to vendor after PO is created and workflow is PO_CONFIRMED. */
export function quoteSendPoPath(quoteId: string, options?: QuotePoNavOptions): string {
  const params = new URLSearchParams();
  if (options?.from === "notification") params.set("from", "notification");
  if (options?.childRequisitionId?.trim()) {
    params.set("childRequisitionId", options.childRequisitionId.trim());
  }
  return appendQuery(`/purchase/quotes/${quoteId}/confirm`, params);
}

export function quoteSendPoUrl(quoteId: string, options?: QuotePoNavOptions): string {
  return `${APP_BASE()}${quoteSendPoPath(quoteId, options)}`;
}
