export function shipyardQuotationPortalUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base}/shipyard/quotations/t/${token}`;
}

export function buildShipyardQuotationMailto(input: {
  contactEmail: string;
  yardName: string;
  referenceCode: string;
  vesselName?: string | null;
  vesselCode?: string | null;
  dueAt?: string | null;
  token: string;
}): string {
  const url = shipyardQuotationPortalUrl(input.token);
  const vessel =
    input.vesselName && input.vesselCode
      ? `${input.vesselName} (${input.vesselCode})`
      : input.vesselName || input.vesselCode || "";
  const subject = encodeURIComponent(
    `Quotation request ${input.referenceCode}${vessel ? ` — ${vessel}` : ""}`,
  );
  const body = encodeURIComponent(
    `Dear ${input.yardName},\n\n` +
      `You are invited to submit a quotation for dry-dock / repair jobs on our platform.\n\n` +
      `Reference: ${input.referenceCode}\n` +
      (vessel ? `Vessel: ${vessel}\n` : "") +
      (input.dueAt ? `Due: ${input.dueAt}\n` : "") +
      `\nOpen the secure link below to review vessel details, timeline, jobs, tariffs, and submit your quote:\n\n` +
      `${url}\n\n` +
      `This link is unique to your yard. Do not share it.\n\n` +
      `Best regards`,
  );
  return `mailto:${input.contactEmail}?subject=${subject}&body=${body}`;
}
