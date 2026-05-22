export interface LineItem {
  serviceName: string;
  category?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
  sheetName: string;
  rowIndex: number;
}

export interface VendorQuote {
  vendorName: string;
  fileName: string;
  items: LineItem[];
}

export interface ServiceMatch {
  canonicalId: string;
  canonicalName: string;
  category?: string;
  vendorItemId: string;
  vendorName: string;
  originalName: string;
  score: number;
  autoMatched: boolean;
}

export interface CanonicalService {
  id: string;
  name: string;
  category?: string;
}

export interface MatchedRow {
  service: CanonicalService;
  byVendor: Record<
    string,
    {
      item: LineItem | null;
      match: ServiceMatch | null;
    }
  >;
}

export interface ComparisonResult {
  vendors: string[];
  rows: MatchedRow[];
  unmatchedByVendor: Record<string, LineItem[]>;
}

export interface ParseOptions {
  serviceColumn?: number;
  priceColumns?: number[];
  headerRow?: number;
}
