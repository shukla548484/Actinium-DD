import {
  buildShipyardQuotationMailto,
  shipyardQuotationPortalUrl,
} from "@/lib/shipyard/quotationMailto";

export type ShipyardQuotationInviteEmailInput = {
  contactEmail: string | null | undefined;
  yardName: string;
  referenceCode: string;
  vesselName?: string | null;
  vesselCode?: string | null;
  dueAt?: string | null;
  token: string;
  jobTitles?: string[];
  notes?: string | null;
};

export type ShipyardQuotationInviteEmailResult =
  | { sent: true; provider: "resend"; id: string }
  | { sent: false; reason: "no_email" | "no_provider" | "send_failed"; detail?: string };

/** Prefer Resend when RESEND_API_KEY is set; otherwise caller falls back to mailto. */
export async function trySendShipyardQuotationInviteEmail(
  input: ShipyardQuotationInviteEmailInput,
): Promise<ShipyardQuotationInviteEmailResult> {
  const to = input.contactEmail?.trim();
  if (!to) return { sent: false, reason: "no_email" };

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false, reason: "no_provider" };

  const portalUrl = shipyardQuotationPortalUrl(input.token);
  const vessel =
    input.vesselName && input.vesselCode
      ? `${input.vesselName} (${input.vesselCode})`
      : input.vesselName || input.vesselCode || "";
  const jobsHtml =
    input.jobTitles && input.jobTitles.length > 0
      ? `<ul>${input.jobTitles
          .slice(0, 40)
          .map((t) => `<li>${escapeHtml(t)}</li>`)
          .join("")}${
          input.jobTitles.length > 40
            ? `<li>…and ${input.jobTitles.length - 40} more</li>`
            : ""
        }</ul>`
      : "";

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "Actinium Dry Dock <onboarding@resend.dev>";

  const subject = `Quotation request ${input.referenceCode}${vessel ? ` — ${vessel}` : ""}`;
  const html = `
    <p>Dear ${escapeHtml(input.yardName)},</p>
    <p>You are invited to submit a quotation for dry-dock / repair jobs.</p>
    <p><strong>Reference:</strong> ${escapeHtml(input.referenceCode)}<br/>
    ${vessel ? `<strong>Vessel:</strong> ${escapeHtml(vessel)}<br/>` : ""}
    ${input.dueAt ? `<strong>Due:</strong> ${escapeHtml(input.dueAt)}<br/>` : ""}
    </p>
    ${input.notes ? `<p><strong>Notes:</strong><br/>${escapeHtml(input.notes)}</p>` : ""}
    ${jobsHtml ? `<p><strong>Jobs included:</strong></p>${jobsHtml}` : ""}
    <p><a href="${escapeHtml(portalUrl)}">Open quotation workspace</a></p>
    <p style="color:#666;font-size:12px">This link is unique to your yard. Do not share it.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text:
          `Quotation request ${input.referenceCode}\n` +
          (vessel ? `Vessel: ${vessel}\n` : "") +
          `Open: ${portalUrl}\n`,
      }),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        sent: false,
        reason: "send_failed",
        detail: data.message ?? `HTTP ${res.status}`,
      };
    }
    return { sent: true, provider: "resend", id: data.id ?? "ok" };
  } catch (err) {
    return {
      sent: false,
      reason: "send_failed",
      detail: err instanceof Error ? err.message : "send failed",
    };
  }
}

export function mailtoFallback(input: ShipyardQuotationInviteEmailInput): string | null {
  if (!input.contactEmail?.trim()) return null;
  return buildShipyardQuotationMailto({
    contactEmail: input.contactEmail.trim(),
    yardName: input.yardName,
    referenceCode: input.referenceCode,
    vesselName: input.vesselName,
    vesselCode: input.vesselCode,
    dueAt: input.dueAt,
    token: input.token,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
