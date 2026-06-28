import { redirect } from "next/navigation";

export default function LegacyShipyardInvitesRedirect() {
  redirect("/shipyard/tender/invites");
}
