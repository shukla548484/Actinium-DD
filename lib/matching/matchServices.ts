import Fuse from "fuse.js";
import type {
  CanonicalService,
  ComparisonResult,
  LineItem,
  MatchedRow,
  ServiceMatch,
  VendorQuote,
} from "@/lib/types";
import { normalizeServiceText, slugify } from "@/lib/matching/normalize";

function itemKey(vendor: string, item: LineItem): string {
  return `${vendor}:${item.sheetName}:${item.rowIndex}`;
}

export function buildCanonicalServices(
  quotes: VendorQuote[],
  threshold: number,
): { services: CanonicalService[]; matches: ServiceMatch[] } {
  const services: CanonicalService[] = [];
  const matches: ServiceMatch[] = [];

  const addService = (name: string, category?: string): CanonicalService => {
    const id = slugify(name) + "-" + services.length;
    const svc: CanonicalService = { id, name, category };
    services.push(svc);
    return svc;
  };

  const fuseOptions = {
    keys: ["name", "norm"],
    threshold: 1 - threshold,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  };

  let fuse = new Fuse(
    services.map((s) => ({
      ...s,
      norm: normalizeServiceText(s.name),
    })),
    fuseOptions,
  );

  for (const quote of quotes) {
    for (const item of quote.items) {
      const norm = normalizeServiceText(item.serviceName);
      if (!norm) continue;

      const results = fuse.search(norm);
      const best = results[0];
      const score = best?.score != null ? 1 - best.score : 0;

      let canonical: CanonicalService;

      if (best && score >= threshold) {
        canonical = services.find((s) => s.id === best.item.id)!;
        if (!canonical.category && item.category) {
          canonical.category = item.category;
        }
      } else {
        canonical = addService(item.serviceName, item.category);
        fuse = new Fuse(
          services.map((s) => ({
            ...s,
            norm: normalizeServiceText(s.name),
          })),
          fuseOptions,
        );
      }

      matches.push({
        canonicalId: canonical.id,
        canonicalName: canonical.name,
        category: canonical.category,
        vendorItemId: itemKey(quote.vendorName, item),
        vendorName: quote.vendorName,
        originalName: item.serviceName,
        score: best && score >= threshold ? score : 1,
        autoMatched: Boolean(best && score >= threshold),
      });
    }
  }

  return { services, matches };
}

export function buildComparison(
  quotes: VendorQuote[],
  threshold = 0.55,
): ComparisonResult {
  const vendors = quotes.map((q) => q.vendorName);
  const { services, matches } = buildCanonicalServices(quotes, threshold);

  const itemByKey = new Map<string, LineItem>();
  for (const q of quotes) {
    for (const item of q.items) {
      itemByKey.set(itemKey(q.vendorName, item), item);
    }
  }

  const matchByVendorCanonical = new Map<string, ServiceMatch>();
  for (const m of matches) {
    matchByVendorCanonical.set(`${m.vendorName}:${m.canonicalId}`, m);
  }

  const rows: MatchedRow[] = services.map((service) => {
    const byVendor: MatchedRow["byVendor"] = {};
    for (const vendor of vendors) {
      const match = matchByVendorCanonical.get(`${vendor}:${service.id}`) ?? null;
      const item = match
        ? itemByKey.get(match.vendorItemId) ?? null
        : null;
      byVendor[vendor] = { item, match };
    }
    return { service, byVendor };
  });

  const matchedKeys = new Set(matches.map((m) => m.vendorItemId));
  const unmatchedByVendor: Record<string, LineItem[]> = {};
  for (const q of quotes) {
    unmatchedByVendor[q.vendorName] = q.items.filter(
      (item) => !matchedKeys.has(itemKey(q.vendorName, item)),
    );
  }

  return { vendors, rows, unmatchedByVendor };
}

export function remapService(
  comparison: ComparisonResult,
  quotes: VendorQuote[],
  vendorName: string,
  originalName: string,
  targetCanonicalId: string,
): ComparisonResult {
  const quote = quotes.find((q) => q.vendorName === vendorName);
  if (!quote) return comparison;

  const item = quote.items.find((i) => i.serviceName === originalName);
  if (!item) return comparison;

  const threshold = 0.55;
  const cloned = buildComparison(quotes, threshold);
  const row = cloned.rows.find((r) => r.service.id === targetCanonicalId);
  if (row) {
    row.byVendor[vendorName] = {
      item,
      match: {
        canonicalId: targetCanonicalId,
        canonicalName: row.service.name,
        category: row.service.category,
        vendorItemId: itemKey(vendorName, item),
        vendorName,
        originalName,
        score: 1,
        autoMatched: false,
      },
    };
  }
  return cloned;
}
