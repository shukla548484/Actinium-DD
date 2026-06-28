/** Canonical Actinium-DD product logo in /public. */
export const ACTINIUM_PRODUCT_LOGO = "/actinium-sm-logo.png";

export function resolveNavCompanyLogoSrc(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null;
  const url = logoUrl.trim();
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("/api/")
  ) {
    return url;
  }
  if (url.startsWith("/")) return url;
  return `/${url}`;
}
