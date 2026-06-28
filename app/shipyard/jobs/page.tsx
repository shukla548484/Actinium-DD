import { redirect } from "next/navigation";

export default function LegacyShipyardJobsRedirect() {
  redirect("/shipyard/projects");
}
