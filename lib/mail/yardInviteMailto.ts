import { yardPortalUrl } from "@/lib/tender/format";

export function buildYardInviteMailto(input: {
  contactEmail: string;
  yardName: string;
  projectName: string;
  token: string;
  vesselName?: string | null;
}): string {
  const url = yardPortalUrl(input.token);
  const subject = encodeURIComponent(
    `Dry dock tender quote request — ${input.projectName}${input.vesselName ? ` (${input.vesselName})` : ""}`,
  );
  const body = encodeURIComponent(
    `Dear ${input.yardName},\n\n` +
      `You are invited to submit your quotation for our dry-dock tender.\n\n` +
      `Project: ${input.projectName}\n` +
      (input.vesselName ? `Vessel: ${input.vesselName}\n` : "") +
      `\nPlease open the secure link below to enter your rates online:\n\n` +
      `${url}\n\n` +
      `This link is unique to your yard. Do not share it.\n\n` +
      `Best regards`,
  );
  return `mailto:${input.contactEmail}?subject=${subject}&body=${body}`;
}
