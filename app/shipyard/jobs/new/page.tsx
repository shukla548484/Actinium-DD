import { redirect } from "next/navigation";

/** Tender project creation belongs on the superintendent module. */
export default function LegacyShipyardNewJobRedirect() {
  redirect("/projects/new");
}
