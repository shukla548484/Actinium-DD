const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "to",
  "per",
  "unit",
  "service",
  "services",
  "fee",
  "fees",
  "charge",
  "charges",
  "cost",
  "price",
  "rate",
  "item",
  "line",
  "total",
  "amt",
  "amount",
  "qty",
  "quantity",
]);

export function normalizeServiceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(" ");
}

export function slugify(text: string): string {
  return normalizeServiceText(text).replace(/\s+/g, "-") || "unknown";
}
