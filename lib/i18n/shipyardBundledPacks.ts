import {
  getShipyardQuoteBundledTables,
  type ShipyardQuoteLocale,
  type ShipyardQuoteUiKey,
} from "@/lib/i18n/shipyardQuotationUi";

export type ShipyardBundledLangPacks = Record<
  ShipyardQuoteLocale,
  Record<ShipyardQuoteUiKey, string>
>;

/** Static packs shipped with the app (offline seed). */
export const shipyardQuoteBundledPacks: ShipyardBundledLangPacks = getShipyardQuoteBundledTables();
